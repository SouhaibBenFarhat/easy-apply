import type { NormalizedJob } from '@sources/shared'
import { z } from 'zod'
import { buildDedupeKey, cleanText, toIsoOrNull } from '../normalize'
import type { FetchContext, JobSourceProvider, ProviderMeta, RawPayload } from '../types'

// Bundesagentur für Arbeit "Jobsuche" — the Munich anchor source (PLAN.md §4.3,
// live-verified in planning/research/research-jobSources.json). Unofficial but
// tolerated: it powers arbeitsagentur.de's own search. Auth is a single static
// header, no registration. The API renamed its whole response schema between v4
// and v6, so the zod schema below pins the field names observed in
// modules/test-utils/fixtures/ba_v6.json — fixtures over docs, always.
//
// Remote-filter quirks (empirically verified 2026-07-20, for posterity):
// - `homeoffice=true` returns HTTP 500 — never send it.
// - the community-documented `arbeitszeit=ho` value is unreliable in v6
//   (0 hits for Munich software jobs that demonstrably exist).
// - the WORKING server-side filter is the undocumented `homeoffice=nv_true`
//   (its count matches `facetten.homeoffice.counts.nv_true` exactly).
// We need none of them: every job in the plain search response carries a
// `homeofficemoeglich` boolean, so one query per keyword already includes
// remote-capable jobs and a separate homeoffice=nv_true query would only
// duplicate results.

const BA_ENDPOINT = 'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs'
const BA_API_KEY = 'jobboerse-jobsuche' // public static key — not a secret
const BA_JOBDETAIL_URL = 'https://www.arbeitsagentur.de/jobsuche/jobdetail/'
const NO_SALARY_MARKER = 'KEINE_ANGABEN'

const meta: ProviderMeta = {
  id: 'ba',
  displayName: 'Arbeitsagentur',
  homepage: 'https://www.arbeitsagentur.de/jobsuche/',
  enabledByDefault: true,
  attribution: { label: 'Bundesagentur für Arbeit', required: false },
  politeness: { minIntervalMinutes: 60, maxRequestsPerSync: 4 },
}

// zod stays module-internal (house rule). Everything is optional + loose: BA
// has renamed fields before, and one odd job must never sink the whole batch.
const baAdresseSchema = z.looseObject({
  ort: z.string().optional(),
  plz: z.string().optional(),
  region: z.string().optional(),
})

const baJobSchema = z.looseObject({
  stellenangebotsTitel: z.string().optional(),
  firma: z.string().optional(),
  referenznummer: z.string().optional(),
  stellenlokationen: z.array(z.looseObject({ adresse: baAdresseSchema.optional() })).optional(),
  homeofficemoeglich: z.boolean().optional(),
  externeURL: z.string().optional(),
  datumErsteVeroeffentlichung: z.string().optional(),
  veroeffentlichungszeitraum: z.looseObject({ von: z.string().optional() }).optional(),
  verguetungsangabe: z.string().optional(),
})

const baResponseSchema = z.looseObject({
  ergebnisliste: z.array(z.unknown()).optional(),
})

export const baProvider: JobSourceProvider = {
  meta,

  async fetch(ctx: FetchContext): Promise<RawPayload[]> {
    const { city, radiusKm, keywords } = ctx.searchProfile
    const payloads: RawPayload[] = []
    // One search per keyword, hard-capped by the politeness budget.
    for (const keyword of keywords.slice(0, meta.politeness.maxRequestsPerSync)) {
      const params = new URLSearchParams({
        was: keyword,
        wo: city,
        umkreis: String(radiusKm),
        size: '100',
        page: '1',
      })
      const body = await ctx.http.getText(`${BA_ENDPOINT}?${params.toString()}`, {
        headers: { 'X-API-Key': BA_API_KEY },
      })
      payloads.push({ kind: 'search', body })
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
    const root = baResponseSchema.safeParse(json)
    if (!root.success) return []
    const jobs: NormalizedJob[] = []
    const seen = new Set<string>()
    for (const entry of root.data.ergebnisliste ?? []) {
      const parsed = baJobSchema.safeParse(entry)
      if (!parsed.success) continue
      const job = parsed.data
      const refnr = job.referenznummer?.trim() ?? ''
      const title = job.stellenangebotsTitel?.trim() ?? ''
      const company = job.firma?.trim() ?? ''
      if (refnr === '' || title === '' || company === '') continue // unlinkable/unusable
      const id = `ba:${refnr}`
      if (seen.has(id)) continue // keyword searches overlap — dedupe within the batch
      seen.add(id)
      const adresse = job.stellenlokationen?.[0]?.adresse
      const ort = adresse?.ort?.trim() ?? ''
      const region = adresse?.region?.trim() ?? ''
      // ~Always 'KEINE_ANGABEN' (German employers rarely state pay); keep any
      // real free-text value as salary.raw, never attempt to parse numbers.
      const verguetung = job.verguetungsangabe?.trim() ?? ''
      jobs.push({
        id,
        sourceId: 'ba',
        url: `${BA_JOBDETAIL_URL}${encodeURIComponent(refnr)}`,
        applyUrl: job.externeURL ?? null,
        title: cleanText(title),
        company: cleanText(company),
        locationRaw: [ort, region].filter((part) => part !== '').join(', '),
        city: ort === '' ? null : ort,
        country: 'DE',
        workMode: job.homeofficemoeglich === true ? 'hybrid' : 'onsite',
        remoteScope: null, // BA lists German employment — no wider scope info
        salary: {
          min: null,
          max: null,
          currency: null,
          period: null,
          isEstimated: false,
          raw: verguetung === '' || verguetung === NO_SALARY_MARKER ? null : verguetung,
        },
        postedAt: toIsoOrNull(
          job.datumErsteVeroeffentlichung ?? job.veroeffentlichungszeitraum?.von,
        ),
        descriptionHtml: null, // the v6 list has no description; v4 detail fetch is out of scope
        tags: [],
        dedupeKey: buildDedupeKey(company, title, ort === '' ? null : ort),
      })
    }
    return jobs
  },
}
