// @vitest-environment node
import { readFileSync } from 'node:fs'
import type { Logger } from '@logger'
import { DEFAULT_SEARCH_PROFILE, type SearchProfile } from '@sources/shared'
import type { PoliteHttpClient } from '../http'
import type { FetchContext } from '../types'
import { remoteokProvider } from './remoteok'

// Fixture is a real captured live response — ground truth over any docs.
// Element [0] is the legal/ToS object; elements [1..100] are 100 jobs.
const REMOTEOK = readFileSync(
  new URL('../../../test-utils/fixtures/remoteok.json', import.meta.url),
  'utf8',
)

type RemoteokFeed = Record<string, unknown>[]

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

describe('remoteokProvider.meta', () => {
  it('describes the RemoteOK source with its mandatory attribution', () => {
    expect(remoteokProvider.meta.id).toBe('remoteok')
    expect(remoteokProvider.meta.displayName).toBe('RemoteOK')
    expect(remoteokProvider.meta.homepage).toBe('https://remoteok.com')
    expect(remoteokProvider.meta.enabledByDefault).toBe(true)
    // Linking back with Remote OK named as source is an API ToS condition.
    expect(remoteokProvider.meta.attribution).toEqual({ label: 'Remote OK', required: true })
    expect(remoteokProvider.meta.politeness).toEqual({
      minIntervalMinutes: 120,
      maxRequestsPerSync: 1,
    })
  })
})

describe('remoteokProvider.fetch', () => {
  it('performs the single unpaginated API request', async () => {
    const { ctx, requests } = makeCtx([REMOTEOK])
    const payloads = await remoteokProvider.fetch(ctx)
    expect(payloads).toHaveLength(1)
    expect(payloads[0]?.kind).toBe('jobs')
    expect(payloads[0]?.body).toBe(REMOTEOK)
    expect(requests).toEqual(['https://remoteok.com/api'])
  })

  it('skips the network entirely when the profile wants no remote scopes', async () => {
    const { ctx, requests } = makeCtx([REMOTEOK], { remoteScopes: [] })
    await expect(remoteokProvider.fetch(ctx)).resolves.toEqual([])
    expect(requests).toHaveLength(0)
  })
})

describe('remoteokProvider.parse', () => {
  const { ctx } = makeCtx() // DEFAULT_SEARCH_PROFILE: all three remote scopes
  const feed = { kind: 'jobs', body: REMOTEOK }

  it('keeps the 11 scope-resolvable jobs of the 100 in the capture', () => {
    const jobs = remoteokProvider.parse(feed, ctx)
    // Hand-verified against the fixture: 11 blank-location jobs (→ worldwide);
    // the other 89 carry unmappable free-text locations ('Good Night, ',
    // 'Florida, …', 'Brasil, ', …) and are dropped. The legal element [0] has
    // no id/position and never becomes a job.
    expect(jobs).toHaveLength(11)
    expect(jobs.every((job) => job.id.startsWith('remoteok:'))).toBe(true)
    expect(jobs.every((job) => job.remoteScope === 'worldwide')).toBe(true)
    const ids = new Set(jobs.map((job) => job.id))
    expect(ids.has('remoteok:1135063')).toBe(true) // location '' → worldwide
    expect(ids.has('remoteok:1135067')).toBe(false) // location 'Good Night, '
  })

  it('maps a fixture job onto NormalizedJob field by field', () => {
    const jobs = remoteokProvider.parse(feed, ctx)
    const job = jobs.find((candidate) => candidate.id === 'remoteok:1135063')
    expect(job).toMatchObject({
      id: 'remoteok:1135063',
      sourceId: 'remoteok',
      url: 'https://remoteOK.com/remote-jobs/remote-hr-manager-fast-growing-e-commerce-startup-skinnify-1135063',
      applyUrl:
        'https://remoteOK.com/remote-jobs/remote-hr-manager-fast-growing-e-commerce-startup-skinnify-1135063',
      title: 'HR Manager Fast Growing E Commerce Startup',
      company: 'Skinnify',
      locationRaw: 'Remote', // blank location on an all-remote board
      city: null,
      country: null,
      workMode: 'remote',
      remoteScope: 'worldwide',
      postedAt: '2026-07-19T19:02:18.000Z', // epoch 1784487738 (unix s)
      tags: ['hr', 'exec', 'ecommerce'],
      dedupeKey: 'skinnify|hr manager fast growing e commerce startup|',
    })
    expect(job?.descriptionHtml).toContain('Skinnify')
    // salary_min/salary_max both 0 → not stated
    expect(job?.salary).toEqual({
      min: null,
      max: null,
      currency: null,
      period: null,
      isEstimated: false,
      raw: null,
    })
  })

  it('treats zero salary bounds as absent and keeps stated ones as annual USD', () => {
    const jobs = remoteokProvider.parse(feed, ctx)
    const stated = jobs.find((job) => job.id === 'remoteok:1135014')
    expect(stated?.salary).toEqual({
      min: 60000,
      max: 80000,
      currency: 'USD',
      period: 'year',
      isEstimated: false,
      raw: null,
    })
    // salary_min 150000 but salary_max 0 → max null, currency/period kept
    const minOnly = jobs.find((job) => job.id === 'remoteok:1134940')
    expect(minOnly?.salary).toEqual({
      min: 150000,
      max: null,
      currency: 'USD',
      period: 'year',
      isEstimated: false,
      raw: null,
    })
  })

  it('caps tags at 10', () => {
    const jobs = remoteokProvider.parse(feed, ctx)
    // 1134923 carries 15 tags in the capture
    const job = jobs.find((candidate) => candidate.id === 'remoteok:1134923')
    expect(job?.tags).toHaveLength(10)
    expect(job?.tags[0]).toBe('mobile')
    expect(job?.tags[9]).toBe('ops')
  })

  it('classifies explicit scope keywords in the location text', () => {
    const doctored = JSON.parse(REMOTEOK) as RemoteokFeed
    const blanks = doctored.filter((entry) => entry.location === '')
    const [first, second, third] = blanks
    if (first) first.location = 'Germany'
    if (second) second.location = 'Europe'
    if (third) third.location = 'Worldwide'
    const jobs = remoteokProvider.parse({ kind: 'jobs', body: JSON.stringify(doctored) }, ctx)
    const scope = (id: unknown): string | null | undefined =>
      jobs.find((job) => job.id === `remoteok:${String(id)}`)?.remoteScope
    expect(scope(first?.id)).toBe('germany')
    expect(scope(second?.id)).toBe('europe')
    expect(scope(third?.id)).toBe('worldwide')
    const germanyJob = jobs.find((job) => job.id === `remoteok:${String(first?.id)}`)
    expect(germanyJob?.locationRaw).toBe('Germany')
  })

  it('narrows kept scopes to the profile remoteScopes', () => {
    const germanyOnly = makeCtx([], { remoteScopes: ['germany'] }).ctx
    // Every scope-resolvable capture job is worldwide → all dropped.
    expect(remoteokProvider.parse(feed, germanyOnly)).toEqual([])
    // A doctored Germany job is the only survivor under the narrowed profile.
    const doctored = JSON.parse(REMOTEOK) as RemoteokFeed
    const blank = doctored.find((entry) => entry.location === '')
    if (blank) blank.location = 'Germany'
    const jobs = remoteokProvider.parse(
      { kind: 'jobs', body: JSON.stringify(doctored) },
      germanyOnly,
    )
    expect(jobs).toHaveLength(1)
    expect(jobs[0]?.remoteScope).toBe('germany')
  })

  it('skips entries missing id, position, company, or url and dedupes ids', () => {
    const legal = { legal: 'API Terms of Service…', last_updated: 1784578188 }
    const base = { position: 'Dev', company: 'Acme', url: 'https://x.example', location: '' }
    const body = JSON.stringify([
      legal, // no id/position → skipped without index special-casing
      { ...base, id: '1' },
      { ...base, id: '2', position: '  ' }, // blank title → skipped
      { ...base }, // missing id → skipped
      { ...base, id: '4', company: '' }, // blank company → skipped
      { ...base, id: '5', url: undefined }, // missing url → skipped
      { ...base, id: '1', position: 'Dev again' }, // duplicate id → dropped
      { ...base, id: 6 }, // numeric id → stringified
    ])
    const jobs = remoteokProvider.parse({ kind: 'jobs', body }, ctx)
    expect(jobs.map((job) => job.id)).toEqual(['remoteok:1', 'remoteok:6'])
    expect(jobs[0]?.title).toBe('Dev') // the duplicate did not overwrite
  })

  it('falls back to the date string when epoch is missing', () => {
    const doctored = JSON.parse(REMOTEOK) as RemoteokFeed
    const entry = doctored.find((candidate) => candidate.id === '1135063')
    if (entry) entry.epoch = undefined
    const jobs = remoteokProvider.parse({ kind: 'jobs', body: JSON.stringify(doctored) }, ctx)
    const job = jobs.find((candidate) => candidate.id === 'remoteok:1135063')
    expect(job?.postedAt).toBe('2026-07-19T19:02:18.000Z') // date field, same instant
  })

  it('returns [] for malformed bodies without throwing', () => {
    expect(remoteokProvider.parse({ kind: 'jobs', body: 'not json {' }, ctx)).toEqual([])
    expect(remoteokProvider.parse({ kind: 'jobs', body: '{}' }, ctx)).toEqual([])
    expect(remoteokProvider.parse({ kind: 'jobs', body: '"nope"' }, ctx)).toEqual([])
    expect(remoteokProvider.parse({ kind: 'jobs', body: '[42,null]' }, ctx)).toEqual([])
    expect(remoteokProvider.parse({ kind: 'jobs', body: '[]' }, ctx)).toEqual([])
  })
})
