// @vitest-environment node
import { readFileSync } from 'node:fs'
import type { Logger } from '@logger'
import { DEFAULT_SEARCH_PROFILE, type SearchProfile } from '@sources/shared'
import type { PoliteHttpClient } from '../http'
import type { FetchContext } from '../types'
import { adzunaProvider } from './adzuna'

// Adzuna answers AUTH_FAIL without a registered key (NEEDS_KEY at the
// 2026-07-20 live verification), so the fixture is synthetic — field names
// from the developer docs + planning/research/research-jobSources.json.
const ADZUNA = readFileSync(
  new URL('../../../test-utils/fixtures/adzuna.synthetic.json', import.meta.url),
  'utf8',
)

interface AdzunaPage {
  results: Record<string, unknown>[]
}

interface Harness {
  ctx: FetchContext
  requests: string[]
  logs: string[]
}

const KEY_CONFIG = { app_id: 'id-123', app_key: 'key-456' }

function makeCtx(
  bodies: string[] = [],
  profile: Partial<SearchProfile> = {},
  config: Record<string, string> = KEY_CONFIG,
): Harness {
  const requests: string[] = []
  const logs: string[] = []
  const record = (message: string, meta?: Record<string, unknown>): void => {
    logs.push(`${message} ${JSON.stringify(meta ?? {})}`)
  }
  const logger: Logger = { debug: record, info: record, warn: record, error: record }
  const queue = [...bodies]
  const http = {
    getText: (url: string): Promise<string> => {
      requests.push(url)
      const next = queue.shift()
      if (next === undefined) return Promise.reject(new Error('stub http exhausted'))
      return Promise.resolve(next)
    },
  } as unknown as PoliteHttpClient
  const ctx: FetchContext = {
    http,
    config,
    searchProfile: { ...DEFAULT_SEARCH_PROFILE, ...profile },
    logger,
  }
  return { ctx, requests, logs }
}

describe('adzunaProvider.meta', () => {
  it('describes the keyed Adzuna source', () => {
    expect(adzunaProvider.meta.id).toBe('adzuna')
    expect(adzunaProvider.meta.displayName).toBe('Adzuna')
    expect(adzunaProvider.meta.homepage).toBe('https://www.adzuna.de')
    expect(adzunaProvider.meta.enabledByDefault).toBe(false) // requires a key
    expect(adzunaProvider.meta.requiresKey).toEqual({
      fields: [
        { id: 'app_id', label: 'Application ID', hint: 'from developer.adzuna.com' },
        { id: 'app_key', label: 'Application key', hint: 'from developer.adzuna.com' },
      ],
    })
    expect(adzunaProvider.meta.attribution).toEqual({ label: 'Jobs by Adzuna', required: true })
    expect(adzunaProvider.meta.politeness).toEqual({
      minIntervalMinutes: 60,
      maxRequestsPerSync: 4,
    })
  })
})

describe('adzunaProvider.fetch', () => {
  it('skips the network entirely without a complete key pair', async () => {
    for (const config of [
      {},
      { app_id: 'id-123' },
      { app_key: 'key-456' },
      { app_id: '', app_key: 'key-456' },
      { app_id: 'id-123', app_key: '' },
    ]) {
      const { ctx, requests } = makeCtx([ADZUNA], {}, config)
      await expect(adzunaProvider.fetch(ctx)).resolves.toEqual([])
      expect(requests).toHaveLength(0)
    }
  })

  it('requests pages 1 and 2 per keyword with the page as a path segment', async () => {
    const { ctx, requests } = makeCtx([ADZUNA, ADZUNA])
    const payloads = await adzunaProvider.fetch(ctx)
    expect(payloads).toHaveLength(2)
    expect(payloads.every((payload) => payload.kind === 'search')).toBe(true)
    const query =
      'app_id=id-123&app_key=key-456&what=software&where=M%C3%BCnchen&distance=25' +
      '&results_per_page=50&sort_by=date&max_days_old=30'
    expect(requests).toEqual([
      `https://api.adzuna.com/v1/api/jobs/de/search/1?${query}`,
      `https://api.adzuna.com/v1/api/jobs/de/search/2?${query}`,
    ])
  })

  it('spends the request budget across keywords in profile order', async () => {
    const { ctx, requests } = makeCtx([ADZUNA, ADZUNA, ADZUNA, ADZUNA], {
      keywords: ['software', 'react', 'python'],
    })
    const payloads = await adzunaProvider.fetch(ctx)
    expect(payloads).toHaveLength(4) // maxRequestsPerSync — python never runs
    expect(requests.filter((url) => url.includes('what=software'))).toHaveLength(2)
    expect(requests.filter((url) => url.includes('what=react'))).toHaveLength(2)
    expect(requests.filter((url) => url.includes('what=python'))).toHaveLength(0)
  })

  it('never logs the key or the query string', async () => {
    const { ctx, logs } = makeCtx([ADZUNA, ADZUNA])
    await adzunaProvider.fetch(ctx)
    expect(logs.length).toBeGreaterThan(0)
    const logged = logs.join('\n')
    expect(logged).not.toContain('id-123')
    expect(logged).not.toContain('key-456')
    expect(logged).not.toContain('app_key')
  })
})

describe('adzunaProvider.parse', () => {
  const { ctx } = makeCtx()
  const page = { kind: 'search', body: ADZUNA }

  it('keeps the 5 linkable jobs and skips the one missing redirect_url', () => {
    const jobs = adzunaProvider.parse(page, ctx)
    expect(jobs).toHaveLength(5)
    const ids = jobs.map((job) => job.id)
    expect(ids).toEqual([
      'adzuna:5223133401',
      'adzuna:5223133415',
      'adzuna:5223133423',
      'adzuna:5223133447', // JSON number id → stringified
      'adzuna:5223133458',
    ])
    // Prüfstand Labs lacks redirect_url (the attribution link) → skipped
    expect(jobs.some((job) => job.company.includes('Prüfstand'))).toBe(false)
  })

  it('maps an employer-stated salary job onto NormalizedJob field by field', () => {
    const [job] = adzunaProvider.parse(page, ctx)
    expect(job).toMatchObject({
      id: 'adzuna:5223133401',
      sourceId: 'adzuna',
      url: 'https://www.adzuna.de/land/ad/5223133401',
      applyUrl: null,
      title: 'Senior Backend Engineer (m/w/d)',
      company: 'Isar Payments GmbH',
      locationRaw: 'München, Bayern',
      city: 'München',
      country: 'DE',
      workMode: 'hybrid', // "Arbeitsmodell: hybrid …" in the description
      remoteScope: null,
      postedAt: '2026-07-18T09:12:44.000Z',
      tags: ['IT Jobs', 'full_time'],
      dedupeKey: 'isar payments|senior backend engineer|münchen',
    })
    expect(job?.descriptionHtml).toContain('Isar Payments')
    expect(job?.salary).toEqual({
      min: 78000,
      max: 96000,
      currency: 'EUR',
      period: 'year',
      isEstimated: false, // salary_is_predicted '0' → employer-stated
      raw: null,
    })
  })

  it('marks model-predicted salaries as estimated in both wire forms', () => {
    const jobs = adzunaProvider.parse(page, ctx)
    const estimated = (id: string): boolean | undefined =>
      jobs.find((job) => job.id === id)?.salary.isEstimated
    expect(estimated('adzuna:5223133423')).toBe(true) // salary_is_predicted '1'
    expect(estimated('adzuna:5223133447')).toBe(true) // salary_is_predicted 1
    expect(estimated('adzuna:5223133401')).toBe(false) // '0'
    expect(estimated('adzuna:5223133415')).toBe(false)
  })

  it('maps zero salary bounds to an all-null salary', () => {
    const jobs = adzunaProvider.parse(page, ctx)
    const student = jobs.find((job) => job.id === 'adzuna:5223133458')
    expect(student?.salary).toEqual({
      min: null,
      max: null,
      currency: null,
      period: null,
      isEstimated: false,
      raw: null,
    })
  })

  it('derives city from the last area element, else display_name first segment', () => {
    const jobs = adzunaProvider.parse(page, ctx)
    const platform = jobs.find((job) => job.id === 'adzuna:5223133415')
    expect(platform?.city).toBe('Garching bei München') // area[-1], not display_name
    expect(platform?.locationRaw).toBe('Garching bei München, Oberbayern')
    const frontend = jobs.find((job) => job.id === 'adzuna:5223133423')
    expect(frontend?.city).toBe('München') // empty area → 'München, Bayern' first segment
  })

  it('classifies work modes from title/description/location heuristics', () => {
    const jobs = adzunaProvider.parse(page, ctx)
    const mode = (id: string): string | undefined => jobs.find((job) => job.id === id)?.workMode
    expect(mode('adzuna:5223133415')).toBe('remote') // "im Homeoffice möglich"
    expect(mode('adzuna:5223133447')).toBe('onsite') // "on-site in unserem Rechenzentrum"
    expect(mode('adzuna:5223133458')).toBe('unknown') // no signal
  })

  it('drops trailing gender/all-genders markers from the dedupe key', () => {
    const jobs = adzunaProvider.parse(page, ctx)
    const frontend = jobs.find((job) => job.id === 'adzuna:5223133423')
    expect(frontend?.dedupeKey).toBe('werksviertel digital|frontend developer react|münchen')
    const devops = jobs.find((job) => job.id === 'adzuna:5223133447')
    expect(devops?.dedupeKey).toBe('bergblick systems|devops engineer kubernetes|münchen')
  })

  it('falls back to Unknown when the company is missing and omits absent tags', () => {
    const doctored = JSON.parse(ADZUNA) as AdzunaPage
    const [first] = doctored.results
    if (first) first.company = undefined
    const jobs = adzunaProvider.parse({ kind: 'search', body: JSON.stringify(doctored) }, ctx)
    expect(jobs[0]?.company).toBe('Unknown')
    // Alpenkraft has no contract_time → only the category label survives
    const platform = jobs.find((job) => job.id === 'adzuna:5223133415')
    expect(platform?.tags).toEqual(['Engineering Jobs'])
  })

  it('dedupes repeated ids within one batch and skips id-less or blank-title jobs', () => {
    const doctored = JSON.parse(ADZUNA) as AdzunaPage
    const baseline = adzunaProvider.parse(page, ctx).length
    const [first] = doctored.results
    doctored.results.push({ ...first }) // duplicate id → dropped
    doctored.results.push({ ...first, id: undefined }) // no id → skipped
    doctored.results.push({ ...first, id: 'blank-title', title: '  ' }) // → skipped
    const jobs = adzunaProvider.parse({ kind: 'search', body: JSON.stringify(doctored) }, ctx)
    expect(jobs).toHaveLength(baseline)
  })

  it('returns [] for malformed bodies without throwing', () => {
    expect(adzunaProvider.parse({ kind: 'search', body: 'not json {' }, ctx)).toEqual([])
    expect(adzunaProvider.parse({ kind: 'search', body: '[]' }, ctx)).toEqual([])
    expect(adzunaProvider.parse({ kind: 'search', body: '{"results":"nope"}' }, ctx)).toEqual([])
    expect(adzunaProvider.parse({ kind: 'search', body: '{"results":[42,null]}' }, ctx)).toEqual([])
    expect(adzunaProvider.parse({ kind: 'search', body: '{}' }, ctx)).toEqual([])
  })
})
