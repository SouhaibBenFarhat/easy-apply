// @vitest-environment node
import { fileURLToPath } from 'node:url'
import type { Logger } from '@logger'
import type { AppDatabase } from '@persistence/main'
import {
  createDatabase,
  getJob,
  getProviderStates,
  jobs,
  listRecentSyncRuns,
  providerState,
  setProviderEnabled,
  syncRuns,
  upsertProviderState,
} from '@persistence/main'
import type { NormalizedJob, SourceId } from '@sources/shared'
import { DEFAULT_SEARCH_PROFILE } from '@sources/shared'
import type { PoliteHttpClient } from './http'
// Imported through the barrel so the @sources/main entry point is exercised.
import { runSync, type SyncDeps, type SyncEvent, type SyncSummary, summarizeNewJobs } from './index'
import type { FetchContext, JobSourceProvider, RawPayload } from './types'

const migrationsFolder = fileURLToPath(new URL('../../../drizzle', import.meta.url))

const NOW = new Date('2026-07-21T12:00:00.000Z')
const NOW_ISO = NOW.toISOString()

const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

function makeJob(id: string, overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  const sourceId = id.split(':')[0] as SourceId
  return {
    id,
    sourceId,
    url: `https://example.com/${id}`,
    applyUrl: null,
    title: `Job ${id}`,
    company: 'Acme GmbH',
    locationRaw: 'München',
    city: 'München',
    country: 'DE',
    workMode: 'onsite',
    remoteScope: null,
    salary: { min: null, max: null, currency: null, period: null, isEstimated: false, raw: null },
    postedAt: null,
    descriptionHtml: null,
    tags: [],
    dedupeKey: `acme|job ${id}|münchen`,
    ...overrides,
  }
}

interface FakeProviderOptions {
  id: SourceId
  // One inner array per RawPayload — parse() round-trips through JSON so the
  // fetch/parse split is exercised for real.
  pages?: NormalizedJob[][]
  enabledByDefault?: boolean
  minIntervalMinutes?: number
  failWith?: string
  onFetch?: (ctx: FetchContext) => void
}

function makeProvider(options: FakeProviderOptions): JobSourceProvider {
  const pages = options.pages ?? [[]]
  return {
    meta: {
      id: options.id,
      displayName: options.id,
      homepage: `https://example.com/${options.id}`,
      enabledByDefault: options.enabledByDefault ?? true,
      attribution: { label: options.id, required: false },
      politeness: { minIntervalMinutes: options.minIntervalMinutes ?? 60, maxRequestsPerSync: 5 },
    },
    fetch: async (ctx): Promise<RawPayload[]> => {
      options.onFetch?.(ctx)
      if (options.failWith !== undefined) throw new Error(options.failWith)
      return pages.map((page, index) => ({ kind: `page-${index}`, body: JSON.stringify(page) }))
    },
    parse: (raw: RawPayload): NormalizedJob[] => JSON.parse(raw.body) as NormalizedJob[],
  }
}

let db: AppDatabase

function makeDeps(providers: JobSourceProvider[], overrides: Partial<SyncDeps> = {}): SyncDeps {
  return {
    db,
    providers,
    readConfig: async () => ({}),
    getSearchProfile: async () => DEFAULT_SEARCH_PROFILE,
    createHttp: () => ({}) as unknown as PoliteHttpClient,
    logger: silentLogger,
    now: () => new Date(NOW),
    ...overrides,
  }
}

function collect(events: SyncEvent[]): Pick<SyncDeps, 'emit'> {
  return { emit: (event) => events.push(event) }
}

beforeAll(async () => {
  db = await createDatabase({ migrationsFolder })
})

afterAll(async () => {
  await db.close()
})

beforeEach(async () => {
  await db.drizzle.delete(jobs)
  await db.drizzle.delete(syncRuns)
  await db.drizzle.delete(providerState)
})

describe('runSync — happy path', () => {
  it('runs providers sequentially, upserts their jobs, and emits ordered events', async () => {
    const seen: FetchContext[] = []
    const ba = makeProvider({
      id: 'ba',
      pages: [[makeJob('ba:1'), makeJob('ba:2')]],
      onFetch: (ctx) => seen.push(ctx),
    })
    const arbeitnow = makeProvider({ id: 'arbeitnow', pages: [[makeJob('arbeitnow:1')]] })
    const events: SyncEvent[] = []

    const summary = await runSync(
      makeDeps([ba, arbeitnow], {
        ...collect(events),
        readConfig: async (sourceId) => (sourceId === 'ba' ? { token: 'secret' } : {}),
      }),
    )

    expect(summary).toEqual({
      inserted: 3,
      updated: 0,
      perSource: [
        { sourceId: 'ba', ok: true, inserted: 2, updated: 0, error: null, skipped: false },
        { sourceId: 'arbeitnow', ok: true, inserted: 1, updated: 0, error: null, skipped: false },
      ],
      startedAt: NOW_ISO,
      finishedAt: NOW_ISO,
    })
    expect(events).toEqual([
      { type: 'sync:started', startedAt: NOW_ISO },
      { type: 'source:started', sourceId: 'ba' },
      { type: 'source:finished', sourceId: 'ba', ok: true, inserted: 2, updated: 0, error: null },
      { type: 'source:started', sourceId: 'arbeitnow' },
      {
        type: 'source:finished',
        sourceId: 'arbeitnow',
        ok: true,
        inserted: 1,
        updated: 0,
        error: null,
      },
      { type: 'sync:completed', inserted: 3, updated: 0, failed: [], finishedAt: NOW_ISO },
    ])

    // FetchContext carries the per-source config and the search profile.
    expect(seen).toHaveLength(1)
    expect(seen[0]?.config).toEqual({ token: 'secret' })
    expect(seen[0]?.searchProfile).toEqual(DEFAULT_SEARCH_PROFILE)

    // One completed sync_run per provider, newest first.
    const runs = await listRecentSyncRuns(db)
    expect(runs).toHaveLength(2)
    expect(runs.map((run) => [run.sourceId, run.ok, run.inserted, run.updated])).toEqual(
      expect.arrayContaining([
        ['ba', true, 2, 0],
        ['arbeitnow', true, 1, 0],
      ]),
    )
    expect(await getJob(db, 'ba:2')).not.toBeNull()
  })

  it('counts re-synced jobs as updated, not inserted', async () => {
    const ba = makeProvider({ id: 'ba', pages: [[makeJob('ba:1'), makeJob('ba:2')]] })

    const first = await runSync(makeDeps([ba]))
    expect(first).toMatchObject({ inserted: 2, updated: 0 })

    // force:true because the first pass just stamped lastSyncAt = NOW.
    const second = await runSync(makeDeps([ba]), { force: true })
    expect(second).toMatchObject({ inserted: 0, updated: 2 })
  })

  it('works without emit and now injected (defaults)', async () => {
    const ba = makeProvider({ id: 'ba', pages: [[makeJob('ba:1')]] })

    const before = Date.now()
    const summary = await runSync({
      db,
      providers: [ba],
      readConfig: async () => ({}),
      getSearchProfile: async () => DEFAULT_SEARCH_PROFILE,
      createHttp: () => ({}) as unknown as PoliteHttpClient,
      logger: silentLogger,
    })
    expect(summary.inserted).toBe(1)
    expect(Date.parse(summary.startedAt)).toBeGreaterThanOrEqual(before)
    expect(Date.parse(summary.finishedAt)).toBeGreaterThanOrEqual(Date.parse(summary.startedAt))
  })

  it('dedupes jobs by id across payload pages, last occurrence winning', async () => {
    const duplicate = makeJob('ba:2', { title: 'Job ba:2 (final page)' })
    const ba = makeProvider({
      id: 'ba',
      pages: [
        [makeJob('ba:1'), makeJob('ba:2')],
        [duplicate, makeJob('ba:3')],
      ],
    })

    const summary = await runSync(makeDeps([ba]))
    expect(summary).toMatchObject({ inserted: 3, updated: 0 })
    expect((await getJob(db, 'ba:2'))?.title).toBe('Job ba:2 (final page)')
  })
})

describe('runSync — failure isolation', () => {
  it('records the failing provider and continues with the rest', async () => {
    const ba = makeProvider({ id: 'ba', failWith: 'HTTP 500 for https://example.com/ba' })
    const arbeitnow = makeProvider({ id: 'arbeitnow', pages: [[makeJob('arbeitnow:1')]] })
    const events: SyncEvent[] = []

    const summary = await runSync(makeDeps([ba, arbeitnow], collect(events)))

    expect(summary.perSource).toEqual([
      {
        sourceId: 'ba',
        ok: false,
        inserted: 0,
        updated: 0,
        error: 'HTTP 500 for https://example.com/ba',
        skipped: false,
      },
      { sourceId: 'arbeitnow', ok: true, inserted: 1, updated: 0, error: null, skipped: false },
    ])
    expect(summary).toMatchObject({ inserted: 1, updated: 0 })

    const completed = events.at(-1)
    expect(completed).toEqual({
      type: 'sync:completed',
      inserted: 1,
      updated: 0,
      failed: ['ba'],
      finishedAt: NOW_ISO,
    })
    expect(events).toContainEqual({
      type: 'source:finished',
      sourceId: 'ba',
      ok: false,
      inserted: 0,
      updated: 0,
      error: 'HTTP 500 for https://example.com/ba',
    })

    // The failed attempt still produced a finished sync_run with its error.
    const runs = await listRecentSyncRuns(db)
    const baRun = runs.find((run) => run.sourceId === 'ba')
    expect(baRun).toMatchObject({
      ok: false,
      error: 'HTTP 500 for https://example.com/ba',
      inserted: 0,
      updated: 0,
    })
    expect(baRun?.finishedAt).not.toBeNull()
  })

  it('stringifies non-Error throws into the recorded error', async () => {
    const ba = makeProvider({ id: 'ba' })
    const weird: JobSourceProvider = {
      ...ba,
      fetch: () => Promise.reject('plain string failure'),
    }

    const summary = await runSync(makeDeps([weird]))
    expect(summary.perSource[0]).toMatchObject({ ok: false, error: 'plain string failure' })
  })

  it('stamps lastSyncAt on success AND on failure (failed attempts consume the window)', async () => {
    const ba = makeProvider({ id: 'ba', failWith: 'boom' })
    const arbeitnow = makeProvider({ id: 'arbeitnow', pages: [[makeJob('arbeitnow:1')]] })

    await runSync(makeDeps([ba, arbeitnow]))

    const states = await getProviderStates(db)
    expect(states.find((state) => state.sourceId === 'ba')?.lastSyncAt).toBe(NOW_ISO)
    expect(states.find((state) => state.sourceId === 'arbeitnow')?.lastSyncAt).toBe(NOW_ISO)

    // …and the stamped window makes the immediate re-run skip both.
    const rerun = await runSync(makeDeps([ba, arbeitnow]))
    expect(rerun.perSource.map((entry) => entry.skipped)).toEqual([true, true])
  })
})

describe('runSync — skipping', () => {
  it('skips a provider still inside its politeness window, silently', async () => {
    const oneMinuteAgo = new Date(NOW.getTime() - 60_000).toISOString()
    await upsertProviderState(db, 'ba', { lastSyncAt: oneMinuteAgo })
    const ba = makeProvider({ id: 'ba', pages: [[makeJob('ba:1')]], minIntervalMinutes: 60 })
    const events: SyncEvent[] = []

    const summary = await runSync(makeDeps([ba], collect(events)))

    expect(summary.perSource).toEqual([
      { sourceId: 'ba', ok: true, inserted: 0, updated: 0, error: null, skipped: true },
    ])
    // No source events, no sync_run row — a skip is not an attempt.
    expect(events.map((event) => event.type)).toEqual(['sync:started', 'sync:completed'])
    expect(await listRecentSyncRuns(db)).toEqual([])
  })

  it('runs a provider whose politeness window has elapsed', async () => {
    const longAgo = new Date(NOW.getTime() - 61 * 60_000).toISOString()
    await upsertProviderState(db, 'ba', { lastSyncAt: longAgo })
    const ba = makeProvider({ id: 'ba', pages: [[makeJob('ba:1')]], minIntervalMinutes: 60 })

    const summary = await runSync(makeDeps([ba]))
    expect(summary.perSource[0]).toMatchObject({ skipped: false, inserted: 1 })
  })

  it('force:true overrides the politeness window', async () => {
    const oneMinuteAgo = new Date(NOW.getTime() - 60_000).toISOString()
    await upsertProviderState(db, 'ba', { lastSyncAt: oneMinuteAgo })
    const ba = makeProvider({ id: 'ba', pages: [[makeJob('ba:1')]], minIntervalMinutes: 60 })

    const summary = await runSync(makeDeps([ba]), { force: true })
    expect(summary.perSource[0]).toMatchObject({ skipped: false, ok: true, inserted: 1 })
  })

  it('skips a provider disabled in provider_state', async () => {
    await setProviderEnabled(db, 'ba', false)
    const ba = makeProvider({ id: 'ba', pages: [[makeJob('ba:1')]] })
    const events: SyncEvent[] = []

    const summary = await runSync(makeDeps([ba], collect(events)))

    expect(summary.perSource[0]).toMatchObject({ skipped: true })
    expect(events.map((event) => event.type)).toEqual(['sync:started', 'sync:completed'])
    expect(await listRecentSyncRuns(db)).toEqual([])
  })

  it('falls back to meta.enabledByDefault when no provider_state row exists', async () => {
    const adzuna = makeProvider({
      id: 'adzuna',
      pages: [[makeJob('adzuna:1')]],
      enabledByDefault: false,
    })

    const skipped = await runSync(makeDeps([adzuna]))
    expect(skipped.perSource[0]).toMatchObject({ sourceId: 'adzuna', skipped: true })

    // An explicit enabled=true row overrides the meta default.
    await setProviderEnabled(db, 'adzuna', true)
    const run = await runSync(makeDeps([adzuna]))
    expect(run.perSource[0]).toMatchObject({ sourceId: 'adzuna', skipped: false, inserted: 1 })
  })

  it('only runs the providers named in options.only', async () => {
    const ba = makeProvider({ id: 'ba', pages: [[makeJob('ba:1')]] })
    const arbeitnow = makeProvider({ id: 'arbeitnow', pages: [[makeJob('arbeitnow:1')]] })

    const summary = await runSync(makeDeps([ba, arbeitnow]), { only: ['arbeitnow'] })

    expect(summary.perSource).toEqual([
      { sourceId: 'ba', ok: true, inserted: 0, updated: 0, error: null, skipped: true },
      { sourceId: 'arbeitnow', ok: true, inserted: 1, updated: 0, error: null, skipped: false },
    ])
    expect((await listRecentSyncRuns(db)).map((run) => run.sourceId)).toEqual(['arbeitnow'])
  })
})

describe('summarizeNewJobs', () => {
  function summaryOf(inserted: number, perSource: SyncSummary['perSource'] = []): SyncSummary {
    return { inserted, updated: 0, perSource, startedAt: NOW_ISO, finishedAt: NOW_ISO }
  }

  function entry(
    overrides: Partial<SyncSummary['perSource'][number]>,
  ): SyncSummary['perSource'][number] {
    return {
      sourceId: 'ba',
      ok: true,
      inserted: 0,
      updated: 0,
      error: null,
      skipped: false,
      ...overrides,
    }
  }

  it('reports new jobs with the contributing source count', () => {
    const summary = summaryOf(14, [
      entry({ sourceId: 'ba', inserted: 8 }),
      entry({ sourceId: 'arbeitnow', inserted: 4 }),
      entry({ sourceId: 'himalayas', inserted: 2 }),
    ])
    expect(summarizeNewJobs(summary)).toBe('14 new jobs · 3 sources')
  })

  it('uses singular forms for one job from one source', () => {
    expect(summarizeNewJobs(summaryOf(1, [entry({ inserted: 1 })]))).toBe('1 new job · 1 source')
  })

  it('reports "No new jobs" for a quiet pass', () => {
    expect(summarizeNewJobs(summaryOf(0, [entry({})]))).toBe('No new jobs')
  })

  it('mentions failures alongside new jobs', () => {
    const summary = summaryOf(5, [
      entry({ sourceId: 'ba', inserted: 5 }),
      entry({ sourceId: 'arbeitnow', ok: false, error: 'boom' }),
    ])
    expect(summarizeNewJobs(summary)).toBe('5 new jobs · 1 source · 1 source failed')
  })

  it('mentions failures even without new jobs, pluralized', () => {
    const summary = summaryOf(0, [
      entry({ sourceId: 'ba', ok: false, error: 'boom' }),
      entry({ sourceId: 'arbeitnow', ok: false, error: 'crash' }),
    ])
    expect(summarizeNewJobs(summary)).toBe('No new jobs · 2 sources failed')
  })

  it('ignores skipped providers in both counts', () => {
    const summary = summaryOf(3, [
      entry({ sourceId: 'ba', inserted: 3 }),
      entry({ sourceId: 'arbeitnow', skipped: true }),
      entry({ sourceId: 'himalayas', skipped: true }),
    ])
    expect(summarizeNewJobs(summary)).toBe('3 new jobs · 1 source')
  })
})
