import type { NormalizedJob } from '@sources/shared'
import { z } from 'zod'
import { classifyWorkMode } from '../classify'
import { buildDedupeKey, cleanText, stripHtml, toIsoOrNull } from '../normalize'
import type { FetchContext, JobSourceProvider, ProviderMeta, RawPayload } from '../types'

// Arbeitnow job-board API — the second German anchor source (PLAN.md §4.3,
// live-verified in planning/research/research-jobSources.json). Free, no auth,
// Laravel-style pagination (`links.next` null on the last page). There is NO
// working server-side location filter (?location= appears in the API's own
// links but does not filter), so location filtering happens client-side here.

const ARBEITNOW_ENDPOINT = 'https://www.arbeitnow.com/api/job-board-api'
const DEUTSCHLANDWEIT = 'deutschlandweit'
const MAX_TAGS = 10

const meta: ProviderMeta = {
  id: 'arbeitnow',
  displayName: 'Arbeitnow',
  homepage: 'https://www.arbeitnow.com',
  enabledByDefault: true,
  attribution: { label: 'arbeitnow.com', required: false },
  politeness: { minIntervalMinutes: 60, maxRequestsPerSync: 3 },
}

// zod stays module-internal (house rule). All-optional + loose on purpose:
// Arbeitnow has silently dropped fields before (visa_sponsorship, salary), and
// one odd job must never sink the whole batch.
const arbeitnowJobSchema = z.looseObject({
  slug: z.string().optional(),
  company_name: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  remote: z.boolean().optional(),
  url: z.string().optional(),
  tags: z.array(z.string()).optional(),
  job_types: z.array(z.string()).optional(),
  location: z.string().optional(),
  created_at: z.number().optional(),
})

const arbeitnowPageSchema = z.looseObject({
  data: z.array(z.unknown()).optional(),
})

const arbeitnowLinksSchema = z.looseObject({
  links: z.looseObject({ next: z.string().nullable().optional() }).optional(),
})

// Peek at the pagination cursor without committing to a full parse — a broken
// body simply stops pagination (parse() handles the rest leniently).
function readNextLink(body: string): string | null {
  try {
    const parsed = arbeitnowLinksSchema.safeParse(JSON.parse(body))
    if (!parsed.success) return null
    return parsed.data.links?.next ?? null
  } catch {
    return null
  }
}

// Lowercase + NFD + strip combining marks: 'München' → 'munchen'. Keeps the
// containment checks below umlaut-proof without mangling other characters.
function foldForMatch(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
}

// The board mixes German endonyms and English exonyms for the same city
// ('München' vs 'Munich, Bavaria, Germany'). Even after umlaut folding those
// differ ('munchen' vs 'munich'), so the pair is declared equivalent.
const CITY_EQUIVALENTS: ReadonlyArray<readonly [string, string]> = [['munchen', 'munich']]

function locationMatchesCity(foldedLocation: string, city: string): boolean {
  const wanted = foldForMatch(city)
  if (wanted !== '' && foldedLocation.includes(wanted)) return true
  for (const [a, b] of CITY_EQUIVALENTS) {
    if (wanted.includes(a) && foldedLocation.includes(b)) return true
    if (wanted.includes(b) && foldedLocation.includes(a)) return true
  }
  return false
}

export const arbeitnowProvider: JobSourceProvider = {
  meta,

  async fetch(ctx: FetchContext): Promise<RawPayload[]> {
    const payloads: RawPayload[] = []
    for (let page = 1; page <= meta.politeness.maxRequestsPerSync; page++) {
      const body = await ctx.http.getText(`${ARBEITNOW_ENDPOINT}?page=${page}`)
      payloads.push({ kind: 'page', body })
      if (readNextLink(body) === null) break // last page — stop early
    }
    return payloads
  },

  parse(raw: RawPayload, ctx: FetchContext): NormalizedJob[] {
    let json: unknown
    try {
      json = JSON.parse(raw.body)
    } catch {
      return [] // malformed body → empty batch, never a throw
    }
    const root = arbeitnowPageSchema.safeParse(json)
    if (!root.success) return []
    const jobs: NormalizedJob[] = []
    const seen = new Set<string>()
    for (const entry of root.data.data ?? []) {
      const parsed = arbeitnowJobSchema.safeParse(entry)
      if (!parsed.success) continue
      const job = parsed.data
      const slug = job.slug?.trim() ?? ''
      const title = job.title?.trim() ?? ''
      const company = job.company_name?.trim() ?? ''
      const url = job.url?.trim() ?? ''
      if (slug === '' || title === '' || company === '' || url === '') continue
      const location = job.location?.trim() ?? ''
      const foldedLocation = foldForMatch(location)
      const remote = job.remote === true
      // No server-side location filter exists, so the search-profile gate runs
      // here: remote roles, roles in the profile city, or Germany-wide roles.
      const isGermanyWide = foldedLocation.includes(DEUTSCHLANDWEIT)
      if (!remote && !isGermanyWide && !locationMatchesCity(foldedLocation, ctx.searchProfile.city))
        continue
      const id = `arbeitnow:${slug}`
      if (seen.has(id)) continue // dedupe by id within the batch
      seen.add(id)
      const description = job.description ?? null
      jobs.push({
        id,
        sourceId: 'arbeitnow',
        url,
        applyUrl: null, // the board exposes a single URL — no separate apply link
        title: cleanText(title),
        company: cleanText(company),
        locationRaw: location,
        // location is a city string; keep the first comma segment ('Munich,
        // Bavaria, Germany' → 'Munich'). 'Deutschlandweit' is not a city.
        city: location === '' || isGermanyWide ? null : (location.split(',')[0]?.trim() ?? null),
        country: 'DE',
        // `remote: true` is authoritative. `remote: false` is NOT authoritative
        // about hybrid vs onsite, so the shared text heuristic reads the title/
        // description ('München / Hybrid' → hybrid) instead of explicitRemote.
        workMode: remote
          ? 'remote'
          : classifyWorkMode({
              title,
              description: description === null ? null : stripHtml(description),
              locationRaw: location,
              explicitRemote: null,
            }),
        // The board is Germany-centric (German cities + 'Deutschlandweit'
        // throughout the live payloads), so a bare remote flag is assumed to
        // mean hireable Germany-wide — there is no finer scope field.
        remoteScope: remote ? 'germany' : null,
        // Schema drift: the live payload no longer carries any salary field
        // (older docs mention one) — all-null until the API grows it back.
        salary: {
          min: null,
          max: null,
          currency: null,
          period: null,
          isEstimated: false,
          raw: null,
        },
        postedAt: toIsoOrNull(job.created_at), // unix seconds
        descriptionHtml: description, // sanitized with dompurify before render
        tags: (job.tags ?? [])
          .concat(job.job_types ?? [])
          .map(cleanText)
          .filter((tag) => tag !== '')
          .slice(0, MAX_TAGS),
        dedupeKey: buildDedupeKey(company, title, location === '' ? null : location),
      })
    }
    return jobs
  },
}
