// @vitest-environment node
import { readFileSync } from 'node:fs'
import type { Logger } from '@logger'
import { DEFAULT_SEARCH_PROFILE, type SearchProfile } from '@sources/shared'
import type { PoliteHttpClient } from '../http'
import type { FetchContext } from '../types'
import { arbeitnowProvider } from './arbeitnow'

// Fixture is a real captured live response — ground truth over any docs.
const ARBEITNOW = readFileSync(
  new URL('../../../test-utils/fixtures/arbeitnow.json', import.meta.url),
  'utf8',
)

interface ArbeitnowPage {
  data: Record<string, unknown>[]
  links: Record<string, unknown>
  meta: Record<string, unknown>
}

const lastPage = (): string => {
  const doctored = JSON.parse(ARBEITNOW) as ArbeitnowPage
  doctored.links.next = null
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

describe('arbeitnowProvider.meta', () => {
  it('describes the Arbeitnow source', () => {
    expect(arbeitnowProvider.meta.id).toBe('arbeitnow')
    expect(arbeitnowProvider.meta.displayName).toBe('Arbeitnow')
    expect(arbeitnowProvider.meta.enabledByDefault).toBe(true)
    expect(arbeitnowProvider.meta.attribution).toEqual({ label: 'arbeitnow.com', required: false })
    expect(arbeitnowProvider.meta.politeness).toEqual({
      minIntervalMinutes: 60,
      maxRequestsPerSync: 3,
    })
  })
})

describe('arbeitnowProvider.fetch', () => {
  it('walks pages until the politeness budget when links.next keeps going', async () => {
    const { ctx, requests } = makeCtx([ARBEITNOW, ARBEITNOW, ARBEITNOW])
    const payloads = await arbeitnowProvider.fetch(ctx)
    expect(payloads).toHaveLength(3) // capped at maxRequestsPerSync
    expect(payloads.every((payload) => payload.kind === 'page')).toBe(true)
    expect(requests).toEqual([
      'https://www.arbeitnow.com/api/job-board-api?page=1',
      'https://www.arbeitnow.com/api/job-board-api?page=2',
      'https://www.arbeitnow.com/api/job-board-api?page=3',
    ])
  })

  it('stops early when links.next is null (doctored second page)', async () => {
    const { ctx, requests } = makeCtx([ARBEITNOW, lastPage()])
    const payloads = await arbeitnowProvider.fetch(ctx)
    expect(payloads).toHaveLength(2)
    expect(requests).toHaveLength(2)
  })

  it('stops after one page when the body is not parseable JSON', async () => {
    const { ctx, requests } = makeCtx(['<html>maintenance</html>'])
    const payloads = await arbeitnowProvider.fetch(ctx)
    expect(payloads).toHaveLength(1) // payload still handed to parse (→ [])
    expect(requests).toHaveLength(1)
  })
})

describe('arbeitnowProvider.parse', () => {
  const { ctx } = makeCtx() // DEFAULT_SEARCH_PROFILE: city 'München'
  const page = { kind: 'page', body: ARBEITNOW }

  it('keeps only remote, profile-city, or Deutschlandweit jobs', () => {
    const jobs = arbeitnowProvider.parse(page, ctx)
    // Hand-verified against the fixture: 10 remote:true + 11 Munich/München + 1
    // Deutschlandweit out of 100.
    expect(jobs).toHaveLength(22)
    const ids = new Set(jobs.map((job) => job.id))
    // remote:true in Werther — kept although nowhere near Munich
    expect(ids.has('arbeitnow:mitarbeiter-in-verwaltung-administration-25h-w-werther-448901')).toBe(
      true,
    )
    // English exonym 'Munich, Bavaria, Germany' matches the 'München' profile
    expect(ids.has('arbeitnow:principal-rf-engineer-munich-345155')).toBe(true)
    // Germany-wide role
    expect(ids.has('arbeitnow:produktmanager-depot-management-deutschlandweit-146038')).toBe(true)
    // Berlin onsite job from the fixture is dropped
    expect(ids.has('arbeitnow:senior-recruiter-berlin-hybrid-permanent-full-time-118961')).toBe(
      false,
    )
  })

  it('matches München-located jobs when the profile city is the English exonym', () => {
    const english = makeCtx([], { city: 'Munich' }).ctx
    const ids = new Set(arbeitnowProvider.parse(page, english).map((job) => job.id))
    // location 'München' — kept via the munchen/munich equivalence, reversed
    expect(ids.has('arbeitnow:commercial-director-dach-munchen-364313')).toBe(true)
  })

  it('maps a fixture job onto NormalizedJob field by field', () => {
    const [job] = arbeitnowProvider.parse(page, ctx)
    expect(job).toMatchObject({
      id: 'arbeitnow:werkstudentin-online-marketing-munich-190372',
      sourceId: 'arbeitnow',
      url: 'https://www.arbeitnow.com/jobs/companies/belform-gmbh-co-kg/werkstudentin-online-marketing-munich-190372',
      applyUrl: null,
      title: 'Werkstudent:in Online-Marketing (m/w/d)',
      company: 'BelForm GmbH & Co. KG',
      locationRaw: 'Munich',
      city: 'Munich',
      country: 'DE',
      // remote:false, but the description says 'München / Hybrid' → heuristic
      workMode: 'hybrid',
      remoteScope: null,
      postedAt: '2026-07-20T19:00:25.000Z', // created_at 1784574025 (unix s)
      tags: ['Online Marketing', 'Working student', 'hilfstätigkeit / student'],
    })
    expect(job?.descriptionHtml).toContain('<p>')
    expect(job?.salary).toEqual({
      min: null,
      max: null,
      currency: null,
      period: null,
      isEstimated: false,
      raw: null,
    })
    expect(job?.dedupeKey).toBe('belform|werkstudent in online marketing|munich')
  })

  it('marks remote jobs as remote with germany scope and null city for Deutschlandweit', () => {
    const jobs = arbeitnowProvider.parse(page, ctx)
    const remote = jobs.find(
      (job) => job.id === 'arbeitnow:mitarbeiter-in-verwaltung-administration-25h-w-werther-448901',
    )
    expect(remote?.workMode).toBe('remote')
    expect(remote?.remoteScope).toBe('germany')
    const germanyWide = jobs.find(
      (job) => job.id === 'arbeitnow:produktmanager-depot-management-deutschlandweit-146038',
    )
    expect(germanyWide?.city).toBeNull()
    expect(germanyWide?.locationRaw).toBe('Deutschlandweit')
  })

  it('caps tags + job_types at 10', () => {
    const doctored = JSON.parse(ARBEITNOW) as ArbeitnowPage
    const entry = doctored.data.find((job) => job.remote === true)
    if (entry) {
      entry.tags = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8']
      entry.job_types = ['j1', 'j2', 'j3', 'j4']
    }
    const jobs = arbeitnowProvider.parse({ kind: 'page', body: JSON.stringify(doctored) }, ctx)
    const doctoredJob = jobs.find((job) => job.tags.includes('t1'))
    expect(doctoredJob?.tags).toHaveLength(10)
    expect(doctoredJob?.tags).toEqual(['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 'j1', 'j2'])
  })

  it('dedupes repeated slugs within one batch and skips incomplete jobs', () => {
    const doctored = JSON.parse(ARBEITNOW) as ArbeitnowPage
    const baseline = arbeitnowProvider.parse(page, ctx).length
    const [first] = doctored.data
    doctored.data.push({ ...first }) // duplicate slug → dropped
    doctored.data.push({ ...first, slug: undefined }) // missing slug → skipped
    doctored.data.push({ ...first, slug: 'no-title', title: '  ' }) // blank title → skipped
    const jobs = arbeitnowProvider.parse({ kind: 'page', body: JSON.stringify(doctored) }, ctx)
    expect(jobs).toHaveLength(baseline)
  })

  it('tolerates jobs missing description, tags, job_types, and location', () => {
    const doctored = JSON.parse(ARBEITNOW) as ArbeitnowPage
    const remoteEntry = doctored.data.find((job) => job.remote === true)
    if (remoteEntry) {
      remoteEntry.description = undefined
      remoteEntry.tags = undefined
      remoteEntry.job_types = undefined
      remoteEntry.location = undefined // remote:true keeps it despite no location
    }
    const jobs = arbeitnowProvider.parse({ kind: 'page', body: JSON.stringify(doctored) }, ctx)
    const job = jobs.find((candidate) => candidate.id === `arbeitnow:${remoteEntry?.slug}`)
    expect(job).toMatchObject({
      workMode: 'remote',
      descriptionHtml: null,
      tags: [],
      locationRaw: '',
      city: null,
    })
    expect(job?.dedupeKey.endsWith('|')).toBe(true) // no location hint
  })

  it('classifies a kept job without description from its title/location only', () => {
    const doctored = JSON.parse(ARBEITNOW) as ArbeitnowPage
    const munichEntry = doctored.data.find((job) => job.location === 'Munich')
    if (munichEntry) munichEntry.description = undefined
    const jobs = arbeitnowProvider.parse({ kind: 'page', body: JSON.stringify(doctored) }, ctx)
    const job = jobs.find((candidate) => candidate.id === `arbeitnow:${munichEntry?.slug}`)
    expect(job?.descriptionHtml).toBeNull()
    // 'Werkstudent:in Online-Marketing (m/w/d)' + 'Munich' carry no work-mode
    // signal, so the heuristic lands on 'unknown' instead of the description's
    // 'München / Hybrid'.
    expect(job?.workMode).toBe('unknown')
  })

  it('returns [] for malformed bodies without throwing', () => {
    expect(arbeitnowProvider.parse({ kind: 'page', body: 'not json {' }, ctx)).toEqual([])
    expect(arbeitnowProvider.parse({ kind: 'page', body: '[]' }, ctx)).toEqual([])
    expect(arbeitnowProvider.parse({ kind: 'page', body: '{"data":"nope"}' }, ctx)).toEqual([])
    expect(arbeitnowProvider.parse({ kind: 'page', body: '{"data":[42,null]}' }, ctx)).toEqual([])
    expect(arbeitnowProvider.parse({ kind: 'page', body: '{}' }, ctx)).toEqual([])
  })
})
