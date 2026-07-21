import type { NormalizedJob } from '@sources/shared'
import { z } from 'zod'
import { classifyWorkMode } from '../classify'
import { buildDedupeKey, cleanText, toIsoOrNull } from '../normalize'
import type { FetchContext, JobSourceProvider, ProviderMeta, RawPayload } from '../types'

// Adzuna search API — the ONLY Munich source with systematic salary numbers
// (PLAN.md §4.3, researched in planning/research/research-jobSources.json; the
// live endpoint answers AUTH_FAIL without a key, so the fixture is synthetic).
// Requires a free app_id/app_key pair from developer.adzuna.com, which is why
// enabledByDefault is false: the source turns on when the user pastes a key
// (stored safeStorage-encrypted per §4.9, decrypted into ctx.config by the
// sync engine). Salary caveat: for Germany most numbers are model-predicted
// (`salary_is_predicted`), mapped to salary.isEstimated so the feed renders
// "~ est." honestly. Free-tier limits (ToS): 25 hits/min, 250/day, 1,000/week
// — the politeness budget stays far inside them. Two quirks worth naming: the
// page number is a PATH segment (/search/1), not a query param, and the key
// travels in the query string — so log messages must never include the URL.

const ADZUNA_ENDPOINT = 'https://api.adzuna.com/v1/api/jobs/de/search'
const PAGES_PER_KEYWORD = 2 // 2 × results_per_page=50 jobs per keyword
const RESULTS_PER_PAGE = '50' // API maximum
const MAX_DAYS_OLD = '30'

const meta: ProviderMeta = {
  id: 'adzuna',
  displayName: 'Adzuna',
  homepage: 'https://www.adzuna.de',
  enabledByDefault: false,
  requiresKey: {
    fields: [
      { id: 'app_id', label: 'Application ID', hint: 'from developer.adzuna.com' },
      { id: 'app_key', label: 'Application key', hint: 'from developer.adzuna.com' },
    ],
  },
  attribution: { label: 'Jobs by Adzuna', required: true },
  politeness: { minIntervalMinutes: 60, maxRequestsPerSync: 4 },
}

// zod stays module-internal (house rule). Everything is optional + loose, and
// one odd job must never sink the whole batch. `salary_is_predicted` arrives
// as the string '1'/'0' in live JSON but is documented as a number — accept
// both. `id` is a numeric string in captures, a bare number in docs examples.
const adzunaJobSchema = z.looseObject({
  id: z.union([z.string(), z.number()]).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  company: z.looseObject({ display_name: z.string().optional() }).optional(),
  location: z
    .looseObject({
      display_name: z.string().optional(),
      area: z.array(z.string()).optional(),
    })
    .optional(),
  salary_min: z.number().optional(),
  salary_max: z.number().optional(),
  salary_is_predicted: z.union([z.string(), z.number()]).optional(),
  created: z.string().optional(),
  redirect_url: z.string().optional(),
  category: z.looseObject({ label: z.string().optional() }).optional(),
  contract_time: z.string().optional(),
})

const adzunaResponseSchema = z.looseObject({
  results: z.array(z.unknown()).optional(),
})

export const adzunaProvider: JobSourceProvider = {
  meta,

  async fetch(ctx: FetchContext): Promise<RawPayload[]> {
    const appId = ctx.config.app_id ?? ''
    const appKey = ctx.config.app_key ?? ''
    if (appId === '' || appKey === '') {
      ctx.logger.debug('adzuna: no API key configured — skipping')
      return []
    }
    const { city, radiusKm, keywords } = ctx.searchProfile
    const payloads: RawPayload[] = []
    let budget = meta.politeness.maxRequestsPerSync
    // Two pages per keyword, keywords in profile order, hard-capped by the
    // politeness budget (a later keyword loses its pages before an earlier
    // keyword loses its second page).
    for (const keyword of keywords) {
      for (let page = 1; page <= PAGES_PER_KEYWORD; page++) {
        if (budget === 0) return payloads
        budget--
        const params = new URLSearchParams({
          app_id: appId,
          app_key: appKey,
          what: keyword,
          where: city,
          distance: String(radiusKm),
          results_per_page: RESULTS_PER_PAGE,
          sort_by: 'date',
          max_days_old: MAX_DAYS_OLD,
        })
        // Log path + params only — NEVER the URL: its query string is the key.
        ctx.logger.debug(`adzuna: GET search page ${page} for "${keyword}"`)
        const body = await ctx.http.getText(`${ADZUNA_ENDPOINT}/${page}?${params.toString()}`)
        payloads.push({ kind: 'search', body })
      }
    }
    return payloads
  },

  parse(raw: RawPayload): NormalizedJob[] {
    let json: unknown
    try {
      json = JSON.parse(raw.body)
    } catch {
      return [] // malformed body → empty batch, never a throw
    }
    const root = adzunaResponseSchema.safeParse(json)
    if (!root.success) return []
    const jobs: NormalizedJob[] = []
    const seen = new Set<string>()
    for (const entry of root.data.results ?? []) {
      const parsed = adzunaJobSchema.safeParse(entry)
      if (!parsed.success) continue
      const job = parsed.data
      const sourceKey = job.id === undefined ? '' : String(job.id).trim()
      const title = job.title?.trim() ?? ''
      const redirectUrl = job.redirect_url?.trim() ?? ''
      // redirect_url is the attribution link back to adzuna.de — a job without
      // one is unlinkable and gets skipped, salary numbers or not.
      if (sourceKey === '' || title === '' || redirectUrl === '') continue
      const id = `adzuna:${sourceKey}`
      if (seen.has(id)) continue // keyword searches overlap — dedupe in-batch
      seen.add(id)
      const company = job.company?.display_name?.trim() ?? ''
      const companyName = company === '' ? 'Unknown' : company
      const displayName = job.location?.display_name?.trim() ?? ''
      const area = job.location?.area ?? []
      // area is ordered country → …region… → locality ('München' last), so the
      // last element is the most specific place; display_name ('München,
      // Bayern') leads with the locality when area is missing.
      const lastArea = area.at(-1)?.trim() ?? ''
      const firstSegment = displayName.split(',')[0]?.trim() ?? ''
      const city = lastArea !== '' ? lastArea : firstSegment !== '' ? firstSegment : null
      // Adzuna encodes "no salary data" as zero bounds, not missing fields.
      const salaryMin = job.salary_min !== undefined && job.salary_min > 0 ? job.salary_min : null
      const salaryMax = job.salary_max !== undefined && job.salary_max > 0 ? job.salary_max : null
      const hasSalary = salaryMin !== null || salaryMax !== null
      const tags: string[] = []
      const categoryLabel = job.category?.label?.trim() ?? ''
      if (categoryLabel !== '') tags.push(cleanText(categoryLabel))
      const contractTime = job.contract_time?.trim() ?? ''
      if (contractTime !== '') tags.push(contractTime)
      jobs.push({
        id,
        sourceId: 'adzuna',
        url: redirectUrl,
        applyUrl: null, // redirect_url is the only link the API exposes
        title: cleanText(title),
        company: cleanText(companyName),
        locationRaw: displayName !== '' ? displayName : area.join(', '),
        city,
        country: 'DE', // the /jobs/de/ route serves German listings only
        workMode: classifyWorkMode({
          title,
          description: job.description ?? null,
          locationRaw: displayName,
          explicitRemote: null, // no remote flag for de — heuristic only
        }),
        remoteScope: null, // a Munich-radius search carries no hiring scope
        salary: {
          min: salaryMin,
          max: salaryMax,
          currency: hasSalary ? 'EUR' : null, // de listings are Euro amounts
          period: hasSalary ? 'year' : null, // Adzuna normalizes to annual
          isEstimated: job.salary_is_predicted === '1' || job.salary_is_predicted === 1,
          raw: null,
        },
        postedAt: toIsoOrNull(job.created),
        descriptionHtml: job.description ?? null, // truncated plain text
        tags,
        dedupeKey: buildDedupeKey(companyName, title, city),
      })
    }
    return jobs
  },
}
