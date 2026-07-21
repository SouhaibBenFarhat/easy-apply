import type { NormalizedJob, RemoteScope, SalaryPeriod } from '@sources/shared'
import { z } from 'zod'
import { buildDedupeKey, cleanText, toIsoOrNull } from '../normalize'
import type { FetchContext, JobSourceProvider, ProviderMeta, RawPayload } from '../types'

// Himalayas remote-jobs API — the best remote-in-Germany source (PLAN.md §4.3,
// live-verified in planning/research/research-jobSources.json). No auth; the
// search endpoint's `country=DE` is the only server-side "remote job open to
// Germany" filter of all surveyed boards. Pages are capped at 20 jobs, so one
// sync walks a few sequential pages (429s on excess — stay inside the
// politeness budget). Attribution is contractual: link back and credit
// Himalayas as the source. Live field-name nits from verification: the API
// serves `categories` (docs said category) — fixtures over docs, always.

const HIMALAYAS_SEARCH_ENDPOINT = 'https://himalayas.app/jobs/api/search'
const HIMALAYAS_JOBS_URL = 'https://himalayas.app/jobs'
const JOBS_PER_PAGE = 20 // hard API cap; a shorter page means the last page
const MAX_TAGS = 10

const meta: ProviderMeta = {
  id: 'himalayas',
  displayName: 'Himalayas',
  homepage: 'https://himalayas.app',
  enabledByDefault: true,
  attribution: { label: 'Himalayas', required: true },
  politeness: { minIntervalMinutes: 60, maxRequestsPerSync: 3 },
}

// zod stays module-internal (house rule). Everything is optional + loose:
// verification already caught one silent rename (category → categories), and
// one odd job must never sink the whole batch.
const himalayasJobSchema = z.looseObject({
  title: z.string().optional(),
  excerpt: z.string().optional(),
  companyName: z.string().optional(),
  minSalary: z.number().optional(),
  maxSalary: z.number().optional(),
  salaryPeriod: z.string().optional(),
  currency: z.string().optional(),
  locationRestrictions: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  description: z.string().optional(),
  pubDate: z.union([z.string(), z.number()]).optional(), // unix seconds or ISO
  applicationLink: z.string().optional(),
  guid: z.string().optional(),
})

const himalayasResponseSchema = z.looseObject({
  jobs: z.array(z.unknown()).optional(),
})

// Peek at the page size without committing to a full parse — a broken body
// simply stops pagination (parse() handles the rest leniently).
function countJobs(body: string): number {
  try {
    const parsed = himalayasResponseSchema.safeParse(JSON.parse(body))
    if (!parsed.success) return 0
    return parsed.data.jobs?.length ?? 0
  } catch {
    return 0
  }
}

// Countries a Germany-based profile can plausibly be hired from under a
// "Europe" restriction: EU + EEA + UK + Switzerland. Germany itself is handled
// first in scopeFromRestrictions and never reaches this set.
const EUROPEAN_COUNTRIES: ReadonlySet<string> = new Set([
  'austria',
  'belgium',
  'bulgaria',
  'croatia',
  'cyprus',
  'czechia',
  'czech republic',
  'denmark',
  'estonia',
  'finland',
  'france',
  'greece',
  'hungary',
  'iceland',
  'ireland',
  'italy',
  'latvia',
  'liechtenstein',
  'lithuania',
  'luxembourg',
  'malta',
  'netherlands',
  'norway',
  'poland',
  'portugal',
  'romania',
  'slovakia',
  'slovenia',
  'spain',
  'sweden',
  'switzerland',
  'united kingdom',
])

// locationRestrictions is a list of country names. Empty = hire from anywhere.
// Germany wins over Europe ('Germany, Austria' is a Germany-eligible job), and
// anything not covering Germany at all (US-only lists, …) maps to null so the
// caller skips the job — country=DE narrows the search but is not airtight.
function scopeFromRestrictions(restrictions: string[]): RemoteScope | null {
  if (restrictions.length === 0) return 'worldwide'
  const folded = restrictions.map((entry) => entry.trim().toLowerCase())
  if (folded.some((entry) => entry.includes('germany') || entry.includes('deutschland')))
    return 'germany'
  if (folded.some((entry) => entry.includes('europe') || EUROPEAN_COUNTRIES.has(entry)))
    return 'europe'
  return null
}

function mapSalaryPeriod(period: string | undefined): SalaryPeriod | null {
  switch (period) {
    case 'annual':
      return 'year'
    case 'monthly':
      return 'month'
    case 'hourly':
      return 'hour'
    default:
      return null
  }
}

// Fallback job id when the API omits `guid`: a slug of the application link
// ('https://himalayas.app/…/jobs/x' → 'himalayas-app---jobs-x'-style, stable
// across syncs because the link is).
function slugifyLink(link: string): string {
  return link
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const himalayasProvider: JobSourceProvider = {
  meta,

  async fetch(ctx: FetchContext): Promise<RawPayload[]> {
    // Remote board: nothing useful to fetch when the profile asks for no
    // remote scope at all (remoteScopes only ever holds germany/europe/
    // worldwide, so an empty array is the only "no thanks" state).
    if (ctx.searchProfile.remoteScopes.length === 0) return []
    const keyword = ctx.searchProfile.keywords[0]
    if (keyword === undefined) return []
    const payloads: RawPayload[] = []
    // One query (first keyword only — country=DE already narrows hard), walked
    // page by page within the politeness budget.
    for (let page = 1; page <= meta.politeness.maxRequestsPerSync; page++) {
      const params = new URLSearchParams({ country: 'DE', q: keyword, page: String(page) })
      const body = await ctx.http.getText(`${HIMALAYAS_SEARCH_ENDPOINT}?${params.toString()}`)
      payloads.push({ kind: 'search', body })
      if (countJobs(body) < JOBS_PER_PAGE) break // short page = last page
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
    const root = himalayasResponseSchema.safeParse(json)
    if (!root.success) return []
    const jobs: NormalizedJob[] = []
    const seen = new Set<string>()
    for (const entry of root.data.jobs ?? []) {
      const parsed = himalayasJobSchema.safeParse(entry)
      if (!parsed.success) continue
      const job = parsed.data
      const title = job.title?.trim() ?? ''
      const company = job.companyName?.trim() ?? ''
      if (title === '' || company === '') continue // unusable
      const guid = job.guid?.trim() ?? ''
      const applicationLink = job.applicationLink?.trim() ?? ''
      const sourceKey = guid !== '' ? guid : slugifyLink(applicationLink)
      if (sourceKey === '') continue // no guid, no link → unlinkable
      const restrictions = job.locationRestrictions ?? []
      const remoteScope = scopeFromRestrictions(restrictions)
      if (remoteScope === null) continue // not Germany-eligible (US-only, …)
      const id = `himalayas:${sourceKey}`
      if (seen.has(id)) continue // dedupe by id within the batch
      seen.add(id)
      jobs.push({
        id,
        sourceId: 'himalayas',
        // Required attribution link: the job's own Himalayas page, or the jobs
        // index when the API omits it.
        url: applicationLink === '' ? HIMALAYAS_JOBS_URL : applicationLink,
        applyUrl: null, // the API exposes a single link — no separate apply URL
        title: cleanText(title),
        company: cleanText(company),
        locationRaw: restrictions.join(', ') || 'Remote',
        city: null,
        country: null, // restrictions describe hiring scope, not a job location
        workMode: 'remote', // Himalayas lists remote jobs exclusively
        remoteScope,
        salary: {
          min: job.minSalary ?? null,
          max: job.maxSalary ?? null,
          currency: job.currency ?? null,
          period: mapSalaryPeriod(job.salaryPeriod),
          isEstimated: false,
          raw: null,
        },
        postedAt: toIsoOrNull(job.pubDate), // unix seconds or ISO — both live
        descriptionHtml: job.description ?? job.excerpt ?? null,
        tags: (job.categories ?? [])
          .map(cleanText)
          .filter((tag) => tag !== '')
          .slice(0, MAX_TAGS),
        dedupeKey: buildDedupeKey(company, title, null),
      })
    }
    return jobs
  },
}
