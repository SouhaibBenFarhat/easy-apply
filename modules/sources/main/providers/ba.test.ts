// @vitest-environment node
import { readFileSync } from 'node:fs'
import type { Logger } from '@logger'
import { DEFAULT_SEARCH_PROFILE, type SearchProfile } from '@sources/shared'
import type { PoliteHttpClient } from '../http'
import type { FetchContext } from '../types'
import { baProvider } from './ba'

// Fixtures are real captured live responses — ground truth over any docs.
const fixture = (name: string): string =>
  readFileSync(new URL(`../../../test-utils/fixtures/${name}`, import.meta.url), 'utf8')

const BA_V6 = fixture('ba_v6.json')
const BA_HO = fixture('ba_ho.json')

interface RecordedRequest {
  url: string
  headers: Record<string, string>
}

interface Harness {
  ctx: FetchContext
  requests: RecordedRequest[]
}

const noopLogger: Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }

function makeCtx(bodies: string[] = [], profile: Partial<SearchProfile> = {}): Harness {
  const requests: RecordedRequest[] = []
  const queue = [...bodies]
  const http = {
    getText: (url: string, init?: { headers?: Record<string, string> }): Promise<string> => {
      requests.push({ url, headers: init?.headers ?? {} })
      const next = queue.shift()
      if (next === undefined) return Promise.reject(new Error('stub http exhausted'))
      return Promise.resolve(next)
    },
  } as unknown as PoliteHttpClient
  const ctx: FetchContext = {
    http,
    config: {},
    searchProfile: { ...DEFAULT_SEARCH_PROFILE, ...profile },
    logger: noopLogger,
  }
  return { ctx, requests }
}

describe('baProvider.meta', () => {
  it('describes the Arbeitsagentur source', () => {
    expect(baProvider.meta.id).toBe('ba')
    expect(baProvider.meta.displayName).toBe('Arbeitsagentur')
    expect(baProvider.meta.enabledByDefault).toBe(true)
    expect(baProvider.meta.attribution).toEqual({
      label: 'Bundesagentur für Arbeit',
      required: false,
    })
    expect(baProvider.meta.politeness).toEqual({ minIntervalMinutes: 60, maxRequestsPerSync: 4 })
  })
})

describe('baProvider.fetch', () => {
  it('sends one v6 search per keyword with the static X-API-Key header', async () => {
    const { ctx, requests } = makeCtx([BA_V6, BA_V6], {
      keywords: ['software', 'react'],
      city: 'München',
      radiusKm: 25,
    })
    const payloads = await baProvider.fetch(ctx)
    expect(payloads).toHaveLength(2)
    expect(payloads.every((payload) => payload.kind === 'search')).toBe(true)
    expect(payloads[0]?.body).toBe(BA_V6)
    expect(requests).toHaveLength(2)
    const first = new URL(requests[0]?.url ?? '')
    expect(first.origin + first.pathname).toBe(
      'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs',
    )
    expect(first.searchParams.get('was')).toBe('software')
    expect(first.searchParams.get('wo')).toBe('München')
    expect(first.searchParams.get('umkreis')).toBe('25')
    expect(first.searchParams.get('size')).toBe('100')
    expect(first.searchParams.get('page')).toBe('1')
    expect(requests[0]?.headers).toEqual({ 'X-API-Key': 'jobboerse-jobsuche' })
    expect(new URL(requests[1]?.url ?? '').searchParams.get('was')).toBe('react')
  })

  it('caps requests at the politeness budget even with more keywords', async () => {
    const { ctx, requests } = makeCtx([BA_V6, BA_V6, BA_V6, BA_V6], {
      keywords: ['a', 'b', 'c', 'd', 'e', 'f'],
    })
    const payloads = await baProvider.fetch(ctx)
    expect(payloads).toHaveLength(4)
    expect(requests).toHaveLength(4)
  })
})

describe('baProvider.parse', () => {
  const { ctx } = makeCtx()

  it('parses every valid job from the real ba_v6 capture', () => {
    const jobs = baProvider.parse({ kind: 'search', body: BA_V6 }, ctx)
    const listed = (JSON.parse(BA_V6) as { ergebnisliste: unknown[] }).ergebnisliste
    expect(jobs.length).toBeGreaterThan(0)
    expect(jobs).toHaveLength(listed.length) // every fixture job is valid
  })

  it('maps the first fixture job onto NormalizedJob field by field', () => {
    const [job] = baProvider.parse({ kind: 'search', body: BA_V6 }, ctx)
    expect(job).toMatchObject({
      id: 'ba:11112-1484-1779489-1-S',
      sourceId: 'ba',
      url: 'https://www.arbeitsagentur.de/jobsuche/jobdetail/11112-1484-1779489-1-S',
      applyUrl:
        'https://deutschland-stellenmarkt.de/job_show.php?id=bfa$bfa_11112-1484-1779489-1-S',
      title: 'Software Engineer (m/w/d)',
      company: 'Haas Zeitarbeit GmbH',
      locationRaw: 'München, BAYERN',
      city: 'München',
      country: 'DE',
      workMode: 'onsite', // homeofficemoeglich: false
      remoteScope: null,
      postedAt: '2026-07-20T00:00:00.000Z', // datumErsteVeroeffentlichung
      descriptionHtml: null,
      tags: [],
      dedupeKey: 'haas zeitarbeit|software engineer|münchen',
    })
    // verguetungsangabe 'KEINE_ANGABEN' → salary stays fully empty
    expect(job?.salary).toEqual({
      min: null,
      max: null,
      currency: null,
      period: null,
      isEstimated: false,
      raw: null,
    })
  })

  it('maps homeofficemoeglich=true jobs to hybrid (ba_ho capture)', () => {
    const jobs = baProvider.parse({ kind: 'search', body: BA_HO }, ctx)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]?.id).toBe('ba:13644-2961-S')
    expect(jobs[0]?.workMode).toBe('hybrid')
  })

  it('skips jobs missing refnr, title, or firma', () => {
    const doctored = JSON.parse(BA_V6) as { ergebnisliste: Record<string, unknown>[] }
    // Assigning undefined removes the field on re-stringify (JSON drops it).
    const [first, second] = doctored.ergebnisliste
    if (first) first.referenznummer = undefined
    if (second) second.stellenangebotsTitel = undefined
    const total = doctored.ergebnisliste.length
    const jobs = baProvider.parse({ kind: 'search', body: JSON.stringify(doctored) }, ctx)
    expect(jobs).toHaveLength(total - 2)
  })

  it('dedupes repeated referenznummer within one batch', () => {
    const doctored = JSON.parse(BA_HO) as { ergebnisliste: unknown[] }
    doctored.ergebnisliste.push(doctored.ergebnisliste[0])
    const jobs = baProvider.parse({ kind: 'search', body: JSON.stringify(doctored) }, ctx)
    expect(jobs).toHaveLength(1)
  })

  it('keeps a real verguetungsangabe string as salary.raw', () => {
    const doctored = JSON.parse(BA_HO) as { ergebnisliste: Record<string, unknown>[] }
    const entry = doctored.ergebnisliste[0]
    if (entry) entry.verguetungsangabe = '55.000 € - 65.000 € jährlich'
    const [job] = baProvider.parse({ kind: 'search', body: JSON.stringify(doctored) }, ctx)
    expect(job?.salary.raw).toBe('55.000 € - 65.000 € jährlich')
    expect(job?.salary.min).toBeNull()
  })

  it('tolerates jobs missing location, externeURL, and posting dates', () => {
    const doctored = JSON.parse(BA_HO) as { ergebnisliste: Record<string, unknown>[] }
    const entry = doctored.ergebnisliste[0]
    if (entry) {
      entry.stellenlokationen = undefined
      entry.externeURL = undefined
      entry.datumErsteVeroeffentlichung = undefined
      // veroeffentlichungszeitraum.von remains → used as the postedAt fallback
    }
    const [job] = baProvider.parse({ kind: 'search', body: JSON.stringify(doctored) }, ctx)
    expect(job).toMatchObject({
      applyUrl: null,
      locationRaw: '',
      city: null,
      postedAt: '2026-07-10T00:00:00.000Z', // veroeffentlichungszeitraum.von
    })
    expect(job?.dedupeKey.endsWith('|')).toBe(true) // no location hint
  })

  it('yields a null postedAt when every date field is absent', () => {
    const doctored = JSON.parse(BA_HO) as { ergebnisliste: Record<string, unknown>[] }
    const entry = doctored.ergebnisliste[0]
    if (entry) {
      entry.datumErsteVeroeffentlichung = undefined
      entry.veroeffentlichungszeitraum = undefined
    }
    const [job] = baProvider.parse({ kind: 'search', body: JSON.stringify(doctored) }, ctx)
    expect(job?.postedAt).toBeNull()
  })

  it('builds locationRaw from whichever address parts exist', () => {
    const doctored = JSON.parse(BA_V6) as {
      ergebnisliste: { stellenlokationen?: { adresse?: Record<string, unknown> }[] }[]
    }
    const [first, second] = doctored.ergebnisliste
    if (first?.stellenlokationen?.[0]?.adresse)
      first.stellenlokationen[0].adresse.region = undefined
    if (second?.stellenlokationen?.[0]?.adresse) second.stellenlokationen[0].adresse.ort = undefined
    const jobs = baProvider.parse({ kind: 'search', body: JSON.stringify(doctored) }, ctx)
    expect(jobs[0]?.locationRaw).toBe('München') // ort only
    expect(jobs[1]?.locationRaw).toBe('BAYERN') // region only
    expect(jobs[1]?.city).toBeNull()
  })

  it('returns [] for malformed bodies without throwing', () => {
    expect(baProvider.parse({ kind: 'search', body: 'not json {' }, ctx)).toEqual([])
    expect(baProvider.parse({ kind: 'search', body: '[]' }, ctx)).toEqual([])
    expect(baProvider.parse({ kind: 'search', body: '{"ergebnisliste":"nope"}' }, ctx)).toEqual([])
    expect(baProvider.parse({ kind: 'search', body: '{"ergebnisliste":[42,null]}' }, ctx)).toEqual(
      [],
    )
    expect(baProvider.parse({ kind: 'search', body: '{}' }, ctx)).toEqual([])
  })
})
