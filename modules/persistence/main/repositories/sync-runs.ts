import type { SourceId } from '@sources/shared'
import { desc, eq } from 'drizzle-orm'
import type { AppDatabase } from '../db'
import { syncRuns } from '../schema'

type SyncRunRow = typeof syncRuns.$inferSelect

export interface SyncRun {
  id: number
  sourceId: SourceId
  startedAt: string
  finishedAt: string | null
  ok: boolean | null
  error: string | null
  inserted: number
  updated: number
}

export interface SyncRunResult {
  ok: boolean
  error?: string
  inserted?: number
  updated?: number
}

function rowToSyncRun(row: SyncRunRow): SyncRun {
  return {
    id: row.id,
    sourceId: row.sourceId,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt === null ? null : row.finishedAt.toISOString(),
    ok: row.ok,
    error: row.error,
    inserted: row.inserted,
    updated: row.updated,
  }
}

export async function startSyncRun(db: AppDatabase, sourceId: SourceId): Promise<number> {
  const rows = await db.drizzle
    .insert(syncRuns)
    .values({ sourceId, startedAt: new Date() })
    .returning({ id: syncRuns.id })
  const row = rows[0]
  if (row === undefined) throw new Error('startSyncRun: insert returned no row')
  return row.id
}

export async function finishSyncRun(
  db: AppDatabase,
  id: number,
  result: SyncRunResult,
): Promise<SyncRun | null> {
  const rows = await db.drizzle
    .update(syncRuns)
    .set({
      finishedAt: new Date(),
      ok: result.ok,
      error: result.error ?? null,
      inserted: result.inserted ?? 0,
      updated: result.updated ?? 0,
    })
    .where(eq(syncRuns.id, id))
    .returning()
  const row = rows[0]
  return row === undefined ? null : rowToSyncRun(row)
}

export async function listRecentSyncRuns(db: AppDatabase, limit = 20): Promise<SyncRun[]> {
  const rows = await db.drizzle
    .select()
    .from(syncRuns)
    .orderBy(desc(syncRuns.startedAt), desc(syncRuns.id))
    .limit(limit)
  return rows.map(rowToSyncRun)
}
