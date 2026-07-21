import type { Logger } from '@logger'
import type { AppDatabase } from '@persistence/main'
import {
  finishSyncRun,
  getProviderStates,
  startSyncRun,
  upsertJobs,
  upsertProviderState,
} from '@persistence/main'
import type { SearchProfile, SourceId } from '@sources/shared'
import type { PoliteHttpClient } from './http'
import type { FetchContext, JobSourceProvider, ProviderMeta } from './types'

// The sequential, politeness-respecting sync engine (PLAN.md §4.6). Pure and
// dependency-injected — no electron imports — so vitest drives it against an
// in-memory PGlite db with fake providers. The electron glue (scheduler,
// sync:* IPC, renderer broadcast) lives in src/main/sync.ts.

export type SyncEvent =
  | { type: 'sync:started'; startedAt: string }
  | { type: 'source:started'; sourceId: SourceId }
  | {
      type: 'source:finished'
      sourceId: SourceId
      ok: boolean
      inserted: number
      updated: number
      error: string | null
    }
  | {
      type: 'sync:completed'
      inserted: number
      updated: number
      failed: SourceId[]
      finishedAt: string
    }

export interface SyncSummary {
  inserted: number
  updated: number
  perSource: Array<{
    sourceId: SourceId
    ok: boolean
    inserted: number
    updated: number
    error: string | null
    skipped: boolean
  }>
  startedAt: string
  finishedAt: string
}

export interface SyncDeps {
  db: AppDatabase
  providers: readonly JobSourceProvider[]
  readConfig: (sourceId: SourceId) => Promise<Record<string, string>>
  getSearchProfile: () => Promise<SearchProfile>
  createHttp: (meta: ProviderMeta) => PoliteHttpClient
  logger: Logger
  emit?: (event: SyncEvent) => void
  now?: () => Date
}

export async function runSync(
  deps: SyncDeps,
  options: { force?: boolean; only?: SourceId[] } = {},
): Promise<SyncSummary> {
  const { db, logger } = deps
  const now = deps.now ?? ((): Date => new Date())
  const emit = deps.emit ?? ((): void => {})

  const startedAt = now().toISOString()
  emit({ type: 'sync:started', startedAt })

  // Provider states are read once up front — enablement and politeness
  // decisions stay stable for the whole pass.
  const states = await getProviderStates(db)
  const stateById = new Map(states.map((state) => [state.sourceId, state]))
  const searchProfile = await deps.getSearchProfile()

  const perSource: SyncSummary['perSource'] = []
  const failed: SourceId[] = []
  let inserted = 0
  let updated = 0

  // SEQUENTIAL over the registry order on purpose (PLAN.md §2): politeness
  // means no parallel hammering, ever.
  for (const provider of deps.providers) {
    const { meta } = provider
    const state = stateById.get(meta.id)
    const enabled = state?.enabled ?? meta.enabledByDefault
    const filteredOut = options.only !== undefined && !options.only.includes(meta.id)
    const withinInterval =
      options.force !== true &&
      state !== undefined &&
      state.lastSyncAt !== null &&
      now().getTime() - Date.parse(state.lastSyncAt) < meta.politeness.minIntervalMinutes * 60_000
    if (!enabled || filteredOut || withinInterval) {
      // Skips are silent: no sync_run row, no source events — a skip is not
      // an attempt, so it must not look like one anywhere.
      perSource.push({
        sourceId: meta.id,
        ok: true,
        inserted: 0,
        updated: 0,
        error: null,
        skipped: true,
      })
      continue
    }

    emit({ type: 'source:started', sourceId: meta.id })
    const runId = await startSyncRun(db, meta.id)
    const nowIso = now().toISOString()
    try {
      const ctx: FetchContext = {
        http: deps.createHttp(meta),
        config: await deps.readConfig(meta.id),
        searchProfile,
        logger,
      }
      const payloads = await provider.fetch(ctx)
      const jobs = payloads.flatMap((payload) => provider.parse(payload, ctx))
      // Batch-level id dedupe (the same job can appear on two pages of one
      // fetch); last occurrence wins, matching upsertJobs semantics.
      const unique = [...new Map(jobs.map((job) => [job.id, job])).values()]
      const counts = await upsertJobs(db, unique, nowIso)
      await finishSyncRun(db, runId, {
        ok: true,
        inserted: counts.inserted,
        updated: counts.updated,
      })
      await upsertProviderState(db, meta.id, { lastSyncAt: nowIso })
      inserted += counts.inserted
      updated += counts.updated
      perSource.push({
        sourceId: meta.id,
        ok: true,
        inserted: counts.inserted,
        updated: counts.updated,
        error: null,
        skipped: false,
      })
      logger.info(`${meta.id}: +${counts.inserted} new, ${counts.updated} updated`)
      emit({
        type: 'source:finished',
        sourceId: meta.id,
        ok: true,
        inserted: counts.inserted,
        updated: counts.updated,
        error: null,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await finishSyncRun(db, runId, { ok: false, error: message })
      // Failed attempts still consume the politeness window — a hard-failing
      // API shouldn't be hammered again on every scheduler tick, so
      // lastSyncAt advances whether the attempt succeeded or not.
      await upsertProviderState(db, meta.id, { lastSyncAt: nowIso })
      failed.push(meta.id)
      perSource.push({
        sourceId: meta.id,
        ok: false,
        inserted: 0,
        updated: 0,
        error: message,
        skipped: false,
      })
      logger.error(`${meta.id}: sync failed — ${message}`)
      emit({
        type: 'source:finished',
        sourceId: meta.id,
        ok: false,
        inserted: 0,
        updated: 0,
        error: message,
      })
      // One provider failing never sinks the pass — continue with the next.
    }
  }

  const finishedAt = now().toISOString()
  emit({ type: 'sync:completed', inserted, updated, failed, finishedAt })
  return { inserted, updated, perSource, startedAt, finishedAt }
}

function plural(count: number, noun: string): string {
  return count === 1 ? noun : `${noun}s`
}

// The completion-toast line (PLAN.md §4.6): "14 new jobs · 3 sources".
// Skipped providers count as neither sources nor failures.
export function summarizeNewJobs(summary: SyncSummary): string {
  const attempted = summary.perSource.filter((entry) => !entry.skipped)
  const failedCount = attempted.filter((entry) => !entry.ok).length
  const okCount = attempted.length - failedCount

  const parts: string[] = []
  if (summary.inserted > 0) {
    parts.push(
      `${summary.inserted} new ${plural(summary.inserted, 'job')} · ${okCount} ${plural(okCount, 'source')}`,
    )
  } else {
    parts.push('No new jobs')
  }
  if (failedCount > 0) parts.push(`${failedCount} ${plural(failedCount, 'source')} failed`)
  return parts.join(' · ')
}
