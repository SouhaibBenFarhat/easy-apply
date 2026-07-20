import type { SourceId } from '@sources/shared'
import { asc, sql } from 'drizzle-orm'
import type { AppDatabase } from '../db'
import { providerState } from '../schema'

type ProviderStateRow = typeof providerState.$inferSelect

export interface ProviderState {
  sourceId: SourceId
  enabled: boolean
  lastSyncAt: string | null
  configJson: string | null
}

export interface ProviderStatePatch {
  lastSyncAt?: string
  configJson?: string | null
}

function rowToProviderState(row: ProviderStateRow): ProviderState {
  return {
    sourceId: row.sourceId,
    enabled: row.enabled,
    lastSyncAt: row.lastSyncAt === null ? null : row.lastSyncAt.toISOString(),
    configJson: row.configJson,
  }
}

export async function getProviderStates(db: AppDatabase): Promise<ProviderState[]> {
  const rows = await db.drizzle.select().from(providerState).orderBy(asc(providerState.sourceId))
  return rows.map(rowToProviderState)
}

export async function setProviderEnabled(
  db: AppDatabase,
  sourceId: SourceId,
  enabled: boolean,
): Promise<ProviderState> {
  const rows = await db.drizzle
    .insert(providerState)
    .values({ sourceId, enabled })
    .onConflictDoUpdate({ target: providerState.sourceId, set: { enabled } })
    .returning()
  const row = rows[0]
  if (row === undefined) throw new Error('setProviderEnabled: upsert returned no row')
  return rowToProviderState(row)
}

export async function upsertProviderState(
  db: AppDatabase,
  sourceId: SourceId,
  patch: ProviderStatePatch,
): Promise<ProviderState> {
  const set: { lastSyncAt?: Date; configJson?: string | null } = {}
  if (patch.lastSyncAt !== undefined) set.lastSyncAt = new Date(patch.lastSyncAt)
  if (patch.configJson !== undefined) set.configJson = patch.configJson

  // New rows default to enabled — the provider registry (PR 7+) flips keyed /
  // Tier-2 sources off explicitly via setProviderEnabled.
  const insert = db.drizzle.insert(providerState).values({ sourceId, enabled: true, ...set })
  const rows =
    Object.keys(set).length === 0
      ? await insert
          .onConflictDoUpdate({
            target: providerState.sourceId,
            set: { sourceId: sql`excluded.source_id` }, // no-op update so RETURNING yields the row
          })
          .returning()
      : await insert.onConflictDoUpdate({ target: providerState.sourceId, set }).returning()
  const row = rows[0]
  if (row === undefined) throw new Error('upsertProviderState: upsert returned no row')
  return rowToProviderState(row)
}
