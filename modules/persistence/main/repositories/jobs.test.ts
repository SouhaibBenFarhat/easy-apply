// @vitest-environment node
import { fileURLToPath } from 'node:url'
import type { AppDatabase } from '@persistence/main'
import {
  createDatabase,
  getJob,
  jobs,
  listFeed,
  setJobHidden,
  setJobNotes,
  setJobStatus,
  upsertJobs,
} from '@persistence/main'
import type { NormalizedJob } from '@sources/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const migrationsFolder = fileURLToPath(new URL('../../../../drizzle', import.meta.url))

const T0 = '2026-07-20T10:00:00.000Z'
const T1 = '2026-07-21T10:00:00.000Z'

function makeJob(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    id: 'ba:1',
    sourceId: 'ba',
    url: 'https://example.com/job/1',
    applyUrl: null,
    title: 'Software Engineer',
    company: 'Acme GmbH',
    locationRaw: 'München, Bayern',
    city: 'München',
    country: 'DE',
    workMode: 'onsite',
    remoteScope: null,
    salary: { min: null, max: null, currency: null, period: null, isEstimated: false, raw: null },
    postedAt: '2026-07-19T08:00:00.000Z',
    descriptionHtml: '<p>Build things.</p>',
    tags: ['typescript', 'react'],
    dedupeKey: 'acme|software engineer|münchen',
    ...overrides,
  }
}

let db: AppDatabase

beforeAll(async () => {
  db = await createDatabase({ migrationsFolder })
})

afterAll(async () => {
  await db.close()
})

beforeEach(async () => {
  await db.drizzle.delete(jobs)
})

describe('upsertJobs', () => {
  it('returns zero counts for an empty batch', async () => {
    expect(await upsertJobs(db, [], T0)).toEqual({ inserted: 0, updated: 0 })
  })

  it('inserts new jobs and maps every field back through getJob', async () => {
    const job = makeJob({
      applyUrl: 'https://example.com/apply/1',
      salary: {
        min: 60000,
        max: 80000,
        currency: 'EUR',
        period: 'year',
        isEstimated: true,
        raw: '60–80k',
      },
    })
    expect(await upsertJobs(db, [job], T0)).toEqual({ inserted: 1, updated: 0 })

    const stored = await getJob(db, 'ba:1')
    expect(stored).not.toBeNull()
    expect(stored).toMatchObject({
      ...job,
      firstSeenAt: T0,
      fetchedAt: T0,
      status: null,
      statusUpdatedAt: null,
      notes: null,
      hidden: false,
    })
  })

  it('dedupes ids within one batch (last write wins)', async () => {
    const result = await upsertJobs(
      db,
      [makeJob({ title: 'First' }), makeJob({ title: 'Second' })],
      T0,
    )
    expect(result).toEqual({ inserted: 1, updated: 0 })
    expect((await getJob(db, 'ba:1'))?.title).toBe('Second')
  })

  it('re-syncs update volatile fields but preserve firstSeenAt/status/notes/hidden', async () => {
    await upsertJobs(db, [makeJob(), makeJob({ id: 'ba:2', dedupeKey: 'other' })], T0)
    await setJobStatus(db, 'ba:1', 'applied')
    await setJobNotes(db, 'ba:1', 'call back Monday')
    await setJobHidden(db, 'ba:2', true)

    const resync = await upsertJobs(
      db,
      [
        makeJob({ title: 'Senior Software Engineer', postedAt: '2026-07-20T08:00:00.000Z' }),
        makeJob({ id: 'ba:2', dedupeKey: 'other' }),
        makeJob({ id: 'ba:3', dedupeKey: 'third' }),
      ],
      T1,
    )
    expect(resync).toEqual({ inserted: 1, updated: 2 })

    const updated = await getJob(db, 'ba:1')
    expect(updated?.title).toBe('Senior Software Engineer')
    expect(updated?.postedAt).toBe('2026-07-20T08:00:00.000Z')
    expect(updated?.fetchedAt).toBe(T1)
    expect(updated?.firstSeenAt).toBe(T0) // preserved
    expect(updated?.status).toBe('applied') // preserved
    expect(updated?.notes).toBe('call back Monday') // preserved
    expect((await getJob(db, 'ba:2'))?.hidden).toBe(true) // preserved
    expect((await getJob(db, 'ba:3'))?.firstSeenAt).toBe(T1)
  })
})

describe('listFeed', () => {
  beforeEach(async () => {
    await upsertJobs(
      db,
      [
        makeJob({ id: 'ba:onsite', dedupeKey: 'k1' }),
        makeJob({
          id: 'ba:hybrid',
          workMode: 'hybrid',
          postedAt: '2026-07-19T07:00:00.000Z',
          dedupeKey: 'k2',
        }),
        makeJob({
          id: 'himalayas:eu',
          sourceId: 'himalayas',
          workMode: 'remote',
          remoteScope: 'europe',
          title: 'Platform Engineer',
          company: 'Skyline OÜ',
          salary: {
            min: 70000,
            max: null,
            currency: 'EUR',
            period: 'year',
            isEstimated: false,
            raw: null,
          },
          postedAt: '2026-07-18T08:00:00.000Z',
          dedupeKey: 'k3',
        }),
        makeJob({
          id: 'remoteok:ww',
          sourceId: 'remoteok',
          workMode: 'remote',
          remoteScope: 'worldwide',
          title: 'Rust Developer (100%_match)',
          company: 'Ferris Inc',
          postedAt: null,
          dedupeKey: 'k4',
        }),
      ],
      T0,
    )
  })

  it('defaults: newest first, nulls last, hidden excluded, no row cap', async () => {
    const feed = await listFeed(db, {})
    expect(feed.map((job) => job.id)).toEqual([
      'ba:onsite',
      'ba:hybrid',
      'himalayas:eu',
      'remoteok:ww',
    ])
  })

  it('breaks postedAt ties by firstSeenAt desc', async () => {
    await upsertJobs(db, [makeJob({ id: 'ba:late', dedupeKey: 'k5' })], T1)
    const feed = await listFeed(db)
    expect(feed.map((job) => job.id)).toEqual([
      'ba:late', // same postedAt as ba:onsite, newer firstSeenAt
      'ba:onsite',
      'ba:hybrid',
      'himalayas:eu',
      'remoteok:ww',
    ])
  })

  it('filters by workModes', async () => {
    const feed = await listFeed(db, { workModes: ['remote', 'hybrid'] })
    expect(feed.map((job) => job.id)).toEqual(['ba:hybrid', 'himalayas:eu', 'remoteok:ww'])
  })

  it('filters by remoteScopes (null scopes excluded when the filter is set)', async () => {
    const feed = await listFeed(db, { remoteScopes: ['europe'] })
    expect(feed.map((job) => job.id)).toEqual(['himalayas:eu'])
  })

  it('filters by sources', async () => {
    const feed = await listFeed(db, { sources: ['ba'] })
    expect(feed.map((job) => job.id)).toEqual(['ba:onsite', 'ba:hybrid'])
  })

  it('filters by origin (agent inbox vs api)', async () => {
    await upsertJobs(
      db,
      [makeJob({ id: 'linkedin:x', sourceId: 'linkedin', title: 'Agent role', dedupeKey: 'k9' })],
      T0,
    )
    const agent = await listFeed(db, { origin: 'agent' })
    expect(agent.map((job) => job.id)).toEqual(['linkedin:x'])
    const api = await listFeed(db, { origin: 'api' })
    expect(api.map((job) => job.id)).toEqual([
      'ba:onsite',
      'ba:hybrid',
      'himalayas:eu',
      'remoteok:ww',
    ])
  })

  it('filters by hasSalary (min OR max present)', async () => {
    const feed = await listFeed(db, { hasSalary: true })
    expect(feed.map((job) => job.id)).toEqual(['himalayas:eu'])
  })

  it('searches title and company case-insensitively', async () => {
    expect((await listFeed(db, { search: 'platform' })).map((job) => job.id)).toEqual([
      'himalayas:eu',
    ])
    expect((await listFeed(db, { search: 'FERRIS' })).map((job) => job.id)).toEqual(['remoteok:ww'])
    expect(await listFeed(db, { search: 'nowhere' })).toEqual([])
  })

  it('treats LIKE wildcards in search as literals', async () => {
    expect((await listFeed(db, { search: '100%_match' })).map((job) => job.id)).toEqual([
      'remoteok:ww',
    ])
    // '%' only matches the one title containing a literal percent sign —
    // unescaped it would match every row.
    expect((await listFeed(db, { search: '%' })).map((job) => job.id)).toEqual(['remoteok:ww'])
    expect((await listFeed(db, { search: '_' })).map((job) => job.id)).toEqual(['remoteok:ww'])
  })

  it('filters by status and by status: none', async () => {
    await setJobStatus(db, 'ba:onsite', 'applied')
    expect((await listFeed(db, { status: 'applied' })).map((job) => job.id)).toEqual(['ba:onsite'])
    expect((await listFeed(db, { status: 'none' })).map((job) => job.id)).toEqual([
      'ba:hybrid',
      'himalayas:eu',
      'remoteok:ww',
    ])
  })

  it('excludes hidden jobs unless includeHidden', async () => {
    await setJobHidden(db, 'ba:onsite', true)
    expect((await listFeed(db)).map((job) => job.id)).toEqual([
      'ba:hybrid',
      'himalayas:eu',
      'remoteok:ww',
    ])
    expect((await listFeed(db, { includeHidden: true })).map((job) => job.id)).toEqual([
      'ba:onsite',
      'ba:hybrid',
      'himalayas:eu',
      'remoteok:ww',
    ])
  })

  it('applies limit and offset', async () => {
    expect((await listFeed(db, { limit: 2 })).map((job) => job.id)).toEqual([
      'ba:onsite',
      'ba:hybrid',
    ])
    expect((await listFeed(db, { limit: 2, offset: 2 })).map((job) => job.id)).toEqual([
      'himalayas:eu',
      'remoteok:ww',
    ])
  })

  // The feed used to stop at 200 rows, so a growing database silently returned
  // the same 200 forever — new jobs could only displace old ones.
  it('returns every matching row when no limit is asked for', async () => {
    const extra = Array.from({ length: 260 }, (_, i) =>
      makeJob({
        id: `ba:bulk-${i}`,
        dedupeKey: `bulk-${i}`,
        postedAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
      }),
    )
    await upsertJobs(db, extra, T0)

    const feed = await listFeed(db, {})

    expect(feed.length).toBe(264) // 260 bulk + the 4 seeded
    expect(feed.filter((job) => job.id.startsWith('ba:bulk-'))).toHaveLength(260)
  })

  it('combines filters with AND', async () => {
    const feed = await listFeed(db, { workModes: ['remote'], sources: ['himalayas'] })
    expect(feed.map((job) => job.id)).toEqual(['himalayas:eu'])
  })
})

describe('status / notes / hidden transitions', () => {
  beforeEach(async () => {
    await upsertJobs(db, [makeJob()], T0)
  })

  it('setJobStatus stamps statusUpdatedAt and can clear back to null', async () => {
    const applied = await setJobStatus(db, 'ba:1', 'applied')
    expect(applied?.status).toBe('applied')
    expect(applied?.statusUpdatedAt).not.toBeNull()

    const cleared = await setJobStatus(db, 'ba:1', null)
    expect(cleared?.status).toBeNull()
    expect(cleared?.statusUpdatedAt).not.toBeNull() // clearing is also a transition
  })

  it('setJobNotes sets and clears notes without touching statusUpdatedAt', async () => {
    const withNotes = await setJobNotes(db, 'ba:1', 'ping recruiter')
    expect(withNotes?.notes).toBe('ping recruiter')
    expect(withNotes?.statusUpdatedAt).toBeNull()
    expect((await setJobNotes(db, 'ba:1', null))?.notes).toBeNull()
  })

  it('setJobHidden toggles hidden', async () => {
    expect((await setJobHidden(db, 'ba:1', true))?.hidden).toBe(true)
    expect((await setJobHidden(db, 'ba:1', false))?.hidden).toBe(false)
  })

  it('returns null for unknown ids', async () => {
    expect(await getJob(db, 'missing')).toBeNull()
    expect(await setJobStatus(db, 'missing', 'applied')).toBeNull()
    expect(await setJobNotes(db, 'missing', 'x')).toBeNull()
    expect(await setJobHidden(db, 'missing', true)).toBeNull()
  })
})
