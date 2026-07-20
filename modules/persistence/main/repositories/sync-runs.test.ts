// @vitest-environment node
import { fileURLToPath } from 'node:url'
import type { AppDatabase } from '@persistence/main'
import {
  createDatabase,
  finishSyncRun,
  listRecentSyncRuns,
  startSyncRun,
  syncRuns,
} from '@persistence/main'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const migrationsFolder = fileURLToPath(new URL('../../../../drizzle', import.meta.url))

let db: AppDatabase

beforeAll(async () => {
  db = await createDatabase({ migrationsFolder })
})

afterAll(async () => {
  await db.close()
})

beforeEach(async () => {
  await db.drizzle.delete(syncRuns)
})

describe('sync run lifecycle', () => {
  it('startSyncRun opens a pending run', async () => {
    const id = await startSyncRun(db, 'ba')
    expect(id).toBeTypeOf('number')

    const [run] = await listRecentSyncRuns(db)
    expect(run).toMatchObject({
      id,
      sourceId: 'ba',
      finishedAt: null,
      ok: null,
      error: null,
      inserted: 0,
      updated: 0,
    })
    expect(Date.parse(run?.startedAt ?? '')).not.toBeNaN()
  })

  it('finishSyncRun records a success with counts', async () => {
    const id = await startSyncRun(db, 'arbeitnow')
    const run = await finishSyncRun(db, id, { ok: true, inserted: 14, updated: 3 })
    expect(run).toMatchObject({ id, ok: true, error: null, inserted: 14, updated: 3 })
    expect(run?.finishedAt).not.toBeNull()
  })

  it('finishSyncRun records a failure with its error', async () => {
    const id = await startSyncRun(db, 'himalayas')
    const run = await finishSyncRun(db, id, { ok: false, error: 'HTTP 429' })
    expect(run).toMatchObject({ id, ok: false, error: 'HTTP 429', inserted: 0, updated: 0 })
  })

  it('finishSyncRun returns null for an unknown run id', async () => {
    expect(await finishSyncRun(db, 9999, { ok: true })).toBeNull()
  })

  it('listRecentSyncRuns orders newest first and respects the limit', async () => {
    const first = await startSyncRun(db, 'ba')
    const second = await startSyncRun(db, 'remoteok')
    const third = await startSyncRun(db, 'wwr')

    const all = await listRecentSyncRuns(db)
    // startedAt granularity can collide inside one test — id desc breaks ties.
    expect(all.map((run) => run.id)).toEqual([third, second, first])

    const limited = await listRecentSyncRuns(db, 2)
    expect(limited.map((run) => run.id)).toEqual([third, second])
  })
})
