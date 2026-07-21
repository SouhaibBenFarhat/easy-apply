// @vitest-environment node
import { readFileSync } from 'node:fs'
import type { Logger } from '@logger'
import { DEFAULT_SEARCH_PROFILE, type SearchProfile } from '@sources/shared'
import type { PoliteHttpClient } from '../http'
import type { FetchContext } from '../types'
import { himalayasProvider } from './himalayas'

// Himalayas is the one provider without a captured live response (the search
// endpoint rate-limits enthusiastically), so the fixture is synthetic — field
// names verified against the live API in planning/research (2026-07-20).
const HIMALAYAS = readFileSync(
  new URL('../../../test-utils/fixtures/himalayas.synthetic.json', import.meta.url),
  'utf8',
)

interface HimalayasPage {
  jobs: Record<string, unknown>[]
}

// The API serves 20 jobs per full page; the fixture holds 8, so pagination
// tests inflate it to exactly 20 (fetch only counts, it never parses jobs).
const fullPage = (): string => {
  const doctored = JSON.parse(HIMALAYAS) as HimalayasPage
  doctored.jobs = [...doctored.jobs, ...doctored.jobs, ...doctored.jobs].slice(0, 20)
  return JSON.stringify(doctored)
}

interface Harness {
  ctx: FetchContext
  requests: string[]
}

const noopLogger: Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }

function makeCtx(bodies: string[] = [], profile: Partial<SearchProfile> = {}): Harness {
  const requests: string[] = []
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
    config: {},
    searchProfile: { ...DEFAULT_SEARCH_PROFILE, ...profile },
    logger: noopLogger,
  }
  return { ctx, requests }
}

describe('himalayasProvider.meta', () => {
  it('describes the Himalayas source', () => {
    expect(himalayasProvider.meta.id).toBe('himalayas')
    expect(himalayasProvider.meta.displayName).toBe('Himalayas')
    expect(himalayasProvider.meta.homepage).toBe('https://himalayas.app')
    expect(himalayasProvider.meta.enabledByDefault).toBe(true)
    expect(himalayasProvider.meta.attribution).toEqual({ label: 'Himalayas', required: true })
    expect(himalayasProvider.meta.politeness).toEqual({
      minIntervalMinutes: 60,
      maxRequestsPerSync: 3,
    })
  })
})

describe('himalayasProvider.fetch', () => {
  it('skips the network entirely when the profile wants no remote scopes', async () => {
    const { ctx, requests } = makeCtx([HIMALAYAS], { remoteScopes: [] })
    await expect(himalayasProvider.fetch(ctx)).resolves.toEqual([])
    expect(requests).toHaveLength(0)
  })

  it('returns [] when the profile has no keywords', async () => {
    const { ctx, requests } = makeCtx([HIMALAYAS], { keywords: [] })
    await expect(himalayasProvider.fetch(ctx)).resolves.toEqual([])
    expect(requests).toHaveLength(0)
  })

  it('queries country=DE with the first keyword and stops after a short page', async () => {
    const { ctx, requests } = makeCtx([HIMALAYAS], { keywords: ['software', 'react'] })
    const payloads = await himalayasProvider.fetch(ctx)
    expect(payloads).toHaveLength(1) // the 8-job fixture page is < 20 → last
    expect(payloads[0]?.kind).toBe('search')
    expect(payloads[0]?.body).toBe(HIMALAYAS)
    expect(requests).toEqual(['https://himalayas.app/jobs/api/search?country=DE&q=software&page=1'])
  })

  it('walks pages until the politeness budget while pages stay full', async () => {
    const full = fullPage()
    const { ctx, requests } = makeCtx([full, full, full])
    const payloads = await himalayasProvider.fetch(ctx)
    expect(payloads).toHaveLength(3) // capped at maxRequestsPerSync
    expect(requests).toEqual([
      'https://himalayas.app/jobs/api/search?country=DE&q=software&page=1',
      'https://himalayas.app/jobs/api/search?country=DE&q=software&page=2',
      'https://himalayas.app/jobs/api/search?country=DE&q=software&page=3',
    ])
  })

  it('stops early when a later page comes back short', async () => {
    const { ctx, requests } = makeCtx([fullPage(), HIMALAYAS, HIMALAYAS])
    const payloads = await himalayasProvider.fetch(ctx)
    expect(payloads).toHaveLength(2)
    expect(requests).toHaveLength(2)
  })

  it('stops after one page when the body is not parseable JSON', async () => {
    const { ctx, requests } = makeCtx(['<html>maintenance</html>'])
    const payloads = await himalayasProvider.fetch(ctx)
    expect(payloads).toHaveLength(1) // payload still handed to parse (→ [])
    expect(requests).toHaveLength(1)
  })
})

describe('himalayasProvider.parse', () => {
  const { ctx } = makeCtx()
  const page = { kind: 'search', body: HIMALAYAS }

  it('keeps the 5 Germany-eligible jobs and skips US-only + unlinkable ones', () => {
    const jobs = himalayasProvider.parse(page, ctx)
    expect(jobs).toHaveLength(5)
    const ids = new Set(jobs.map((job) => job.id))
    expect(ids.has('himalayas:senior-backend-engineer-solaris-group')).toBe(true)
    expect(ids.has('himalayas:platform-engineer-nova-cloud')).toBe(true)
    expect(ids.has('himalayas:developer-advocate-docsy')).toBe(true)
    expect(ids.has('himalayas:frontend-engineer-ravel-studio')).toBe(true)
    // no guid → id falls back to the slugified application link
    expect(ids.has('himalayas:himalayas-app-companies-loom-and-thread-jobs-product-designer')).toBe(
      true,
    )
    // US-only restrictions → not Germany-eligible → skipped
    expect(ids.has('himalayas:accountant-ledgerly')).toBe(false)
    expect(ids.has('himalayas:customer-success-manager-northwind')).toBe(false)
    // Berlin Analytics lacks both guid and applicationLink → unlinkable
    expect(jobs.some((job) => job.company === 'Berlin Analytics')).toBe(false)
  })

  it('maps a fixture job onto NormalizedJob field by field', () => {
    const [job] = himalayasProvider.parse(page, ctx)
    expect(job).toMatchObject({
      id: 'himalayas:senior-backend-engineer-solaris-group',
      sourceId: 'himalayas',
      url: 'https://himalayas.app/companies/solaris-group/jobs/senior-backend-engineer',
      applyUrl: null,
      title: 'Senior Backend Engineer (m/w/d)',
      company: 'Solaris Group',
      locationRaw: 'Germany',
      city: null,
      country: null,
      workMode: 'remote',
      remoteScope: 'germany',
      postedAt: '2026-07-20T16:00:00.000Z', // pubDate 1784563200 (unix s)
      tags: ['Engineering', 'Backend'],
      dedupeKey: 'solaris group|senior backend engineer|',
    })
    expect(job?.descriptionHtml).toContain('<p>')
    expect(job?.salary).toEqual({
      min: 70000,
      max: 95000,
      currency: 'EUR',
      period: 'year', // salaryPeriod 'annual'
      isEstimated: false,
      raw: null,
    })
  })

  it('maps restriction lists onto scopes with Germany winning over Europe', () => {
    const jobs = himalayasProvider.parse(page, ctx)
    const scope = (id: string): string | null | undefined =>
      jobs.find((job) => job.id === id)?.remoteScope
    // ['Germany', 'Austria'] → germany, not europe
    expect(scope('himalayas:platform-engineer-nova-cloud')).toBe('germany')
    // ['Netherlands', 'Spain', 'Portugal'] → europe
    expect(scope('himalayas:frontend-engineer-ravel-studio')).toBe('europe')
    // empty restrictions array → worldwide
    expect(scope('himalayas:himalayas-app-companies-loom-and-thread-jobs-product-designer')).toBe(
      'worldwide',
    )
    // restrictions field absent entirely → worldwide too
    expect(scope('himalayas:developer-advocate-docsy')).toBe('worldwide')
  })

  it('maps salary periods (hourly/monthly) and leaves absent salaries null', () => {
    const jobs = himalayasProvider.parse(page, ctx)
    const designer = jobs.find((job) => job.company === 'Loom & Thread')
    expect(designer?.salary).toEqual({
      min: 40,
      max: 60,
      currency: 'USD',
      period: 'hour', // salaryPeriod 'hourly'
      isEstimated: false,
      raw: null,
    })
    const frontend = jobs.find((job) => job.id === 'himalayas:frontend-engineer-ravel-studio')
    expect(frontend?.salary.period).toBe('month') // salaryPeriod 'monthly'
    const advocate = jobs.find((job) => job.id === 'himalayas:developer-advocate-docsy')
    expect(advocate?.salary).toEqual({
      min: null,
      max: null,
      currency: null,
      period: null,
      isEstimated: false,
      raw: null,
    })
  })

  it('maps an unknown salaryPeriod to null', () => {
    const doctored = JSON.parse(HIMALAYAS) as HimalayasPage
    const [first] = doctored.jobs
    if (first) first.salaryPeriod = 'weekly'
    const [job] = himalayasProvider.parse({ kind: 'search', body: JSON.stringify(doctored) }, ctx)
    expect(job?.salary.period).toBeNull()
    expect(job?.salary.min).toBe(70000) // amounts survive the odd period
  })

  it('falls back to the excerpt, a null postedAt, and locationRaw Remote', () => {
    const jobs = himalayasProvider.parse(page, ctx)
    // Docsy has no description, no pubDate, and no locationRestrictions
    const advocate = jobs.find((job) => job.id === 'himalayas:developer-advocate-docsy')
    expect(advocate?.descriptionHtml).toBe('Help developers love our docs platform.')
    expect(advocate?.postedAt).toBeNull()
    expect(advocate?.locationRaw).toBe('Remote')
    // Nova Cloud's pubDate is an ISO string instead of unix seconds
    const platform = jobs.find((job) => job.id === 'himalayas:platform-engineer-nova-cloud')
    expect(platform?.postedAt).toBe('2026-07-19T09:30:00.000Z')
  })

  it('links the jobs index when a guid job lacks an applicationLink', () => {
    const doctored = JSON.parse(HIMALAYAS) as HimalayasPage
    const [first] = doctored.jobs
    if (first) first.applicationLink = undefined
    const [job] = himalayasProvider.parse({ kind: 'search', body: JSON.stringify(doctored) }, ctx)
    expect(job?.id).toBe('himalayas:senior-backend-engineer-solaris-group')
    expect(job?.url).toBe('https://himalayas.app/jobs')
  })

  it('caps categories at 10 tags', () => {
    const doctored = JSON.parse(HIMALAYAS) as HimalayasPage
    const [first] = doctored.jobs
    if (first)
      first.categories = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11', 'c12']
    const [job] = himalayasProvider.parse({ kind: 'search', body: JSON.stringify(doctored) }, ctx)
    expect(job?.tags).toHaveLength(10)
    expect(job?.tags[9]).toBe('c10')
  })

  it('dedupes repeated ids within one batch and skips blank titles', () => {
    const doctored = JSON.parse(HIMALAYAS) as HimalayasPage
    const baseline = himalayasProvider.parse(page, ctx).length
    const [first] = doctored.jobs
    doctored.jobs.push({ ...first }) // duplicate guid → dropped
    doctored.jobs.push({ ...first, guid: 'no-title', title: '  ' }) // blank title → skipped
    const jobs = himalayasProvider.parse({ kind: 'search', body: JSON.stringify(doctored) }, ctx)
    expect(jobs).toHaveLength(baseline)
  })

  it('returns [] for malformed bodies without throwing', () => {
    expect(himalayasProvider.parse({ kind: 'search', body: 'not json {' }, ctx)).toEqual([])
    expect(himalayasProvider.parse({ kind: 'search', body: '[]' }, ctx)).toEqual([])
    expect(himalayasProvider.parse({ kind: 'search', body: '{"jobs":"nope"}' }, ctx)).toEqual([])
    expect(himalayasProvider.parse({ kind: 'search', body: '{"jobs":[42,null]}' }, ctx)).toEqual([])
    expect(himalayasProvider.parse({ kind: 'search', body: '{}' }, ctx)).toEqual([])
  })
})
