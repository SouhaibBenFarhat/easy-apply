import type { NormalizedJob } from '@sources/shared'
import { z } from 'zod'
import { classifyRemoteScope } from '../classify'
import { buildDedupeKey, cleanText, toIsoOrNull } from '../normalize'
import type { FetchContext, JobSourceProvider, ProviderMeta, RawPayload } from '../types'

// RemoteOK JSON API — one GET, the latest ~100 jobs, no pagination (PLAN.md
// §4.3, live-verified in planning/research/research-jobSources.json). The
// response array's element [0] is a legal/ToS object, not a job: linking back
// (follow link) and naming Remote OK as the source is a hard API condition, so
// attribution.required is true. The endpoint has historically 403'd
// non-browser user agents — PoliteHttpClient's browser UA covers that. The
// `location` field is messy free text (one live capture had 'Good Night, '),
// so scope classification is deliberately conservative: blank means worldwide,
// unmappable strings (US cities/states, …) drop the job.

const REMOTEOK_ENDPOINT = 'https://remoteok.com/api'
const MAX_TAGS = 10

const meta: ProviderMeta = {
  id: 'remoteok',
  displayName: 'RemoteOK',
  homepage: 'https://remoteok.com',
  enabledByDefault: true,
  attribution: { label: 'Remote OK', required: true },
  politeness: { minIntervalMinutes: 120, maxRequestsPerSync: 1 },
}

// zod stays module-internal (house rule). Everything is optional + loose (the
// legal element [0] must parse too — it is skipped below for having no id),
// and one odd job must never sink the whole batch.
const remoteokJobSchema = z.looseObject({
  id: z.union([z.string(), z.number()]).optional(),
  position: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  tags: z.array(z.string()).optional(),
  salary_min: z.number().optional(),
  salary_max: z.number().optional(),
  description: z.string().optional(),
  date: z.string().optional(),
  epoch: z.number().optional(),
  url: z.string().optional(),
  apply_url: z.string().optional(),
})

export const remoteokProvider: JobSourceProvider = {
  meta,

  async fetch(ctx: FetchContext): Promise<RawPayload[]> {
    // Remote board: skip the request entirely when the profile asks for no
    // remote scope (parse would drop every job anyway — don't spend the
    // 120-minute politeness budget on it).
    if (ctx.searchProfile.remoteScopes.length === 0) return []
    const body = await ctx.http.getText(REMOTEOK_ENDPOINT)
    return [{ kind: 'jobs', body }]
  },

  parse(raw: RawPayload, ctx: FetchContext): NormalizedJob[] {
    let json: unknown
    try {
      json = JSON.parse(raw.body)
    } catch {
      return [] // malformed body → empty batch, never a throw
    }
    if (!Array.isArray(json)) return []
    const jobs: NormalizedJob[] = []
    const seen = new Set<string>()
    for (const entry of json) {
      const parsed = remoteokJobSchema.safeParse(entry)
      if (!parsed.success) continue
      const job = parsed.data
      // The legal/ToS element [0] carries no id/position/company → skipped
      // right here, no index special-casing needed.
      const sourceKey = job.id === undefined ? '' : String(job.id).trim()
      const title = job.position?.trim() ?? ''
      const company = job.company?.trim() ?? ''
      const url = job.url?.trim() ?? ''
      if (sourceKey === '' || title === '' || company === '' || url === '') continue
      const location = job.location ?? ''
      // Blank location on an all-remote board means unrestricted; anything the
      // classifier can't map (US-state strings, junk) is not provably open to
      // Germany → skip. Then the search profile narrows the kept scopes.
      const remoteScope =
        classifyRemoteScope(location) ?? (location.trim() === '' ? 'worldwide' : null)
      if (remoteScope === null) continue
      if (!ctx.searchProfile.remoteScopes.includes(remoteScope)) continue
      const id = `remoteok:${sourceKey}`
      if (seen.has(id)) continue // dedupe by id within the batch
      seen.add(id)
      // salary_min/salary_max are integers with 0 meaning "not stated"; when
      // stated they are annual USD (the board normalizes to $/year).
      const min = (job.salary_min ?? 0) > 0 ? (job.salary_min ?? 0) : null
      const max = (job.salary_max ?? 0) > 0 ? (job.salary_max ?? 0) : null
      const hasSalary = min !== null || max !== null
      jobs.push({
        id,
        sourceId: 'remoteok',
        url, // attribution link back to the Remote OK posting (ToS condition)
        applyUrl: job.apply_url ?? null,
        title: cleanText(title),
        company: cleanText(company),
        locationRaw: cleanText(location) || 'Remote',
        city: null,
        country: null,
        workMode: 'remote', // RemoteOK lists remote jobs exclusively
        remoteScope,
        salary: {
          min,
          max,
          currency: hasSalary ? 'USD' : null,
          period: hasSalary ? 'year' : null,
          isEstimated: false,
          raw: null,
        },
        postedAt: toIsoOrNull(job.epoch ?? job.date), // unix seconds, ISO backup
        descriptionHtml: job.description ?? null,
        tags: (job.tags ?? [])
          .map(cleanText)
          .filter((tag) => tag !== '')
          .slice(0, MAX_TAGS),
        dedupeKey: buildDedupeKey(company, title, null),
      })
    }
    return jobs
  },
}
