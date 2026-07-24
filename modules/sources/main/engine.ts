import type { Logger } from '@logger'
import type { AppDatabase } from '@persistence/main'
import {
  finishSyncRun,
  getProviderStates,
  startSyncRun,
  upsertJobs,
  upsertProviderState,
} from '@persistence/main'
import type { MailScanConfig, SearchProfile, SourceId } from '@sources/shared'
import { DEFAULT_MAIL_SCAN_CONFIG, describeError } from '@sources/shared'
import type { PoliteHttpClient } from './http'
import type { MailAccount, MailDriver } from './mail'
import type { LlmClient } from './mail-extract'
import type {
  FetchContext,
  JobSourceProvider,
  ProcessedMessages,
  ProviderMeta,
  TraceFn,
} from './types'

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
  // The user's first-sweep mail filters, read fresh each pass (like the search
  // profile). Optional: absent falls back to the provider's own default.
  getMailScan?: () => Promise<MailScanConfig>
  createHttp: (meta: ProviderMeta) => PoliteHttpClient
  logger: Logger
  emit?: (event: SyncEvent) => void
  now?: () => Date
  // Email-ingestion runtime, passed to the mailbox provider's ctx. Optional:
  // when the on-device model isn't installed, these are undefined and the
  // mailbox source skips.
  createMail?: (account: MailAccount) => MailDriver
  llm?: LlmClient
  trace?: TraceFn
  // Aborts a long provider run between units of work (Stop / AI off).
  signal?: AbortSignal
  // Cooperative pause seam (Pause/Resume).
  isPaused?: () => boolean
  waitForResume?: () => Promise<void>
  // Already-scanned email memory, so a sync only LLMs new mail.
  processedMessages?: ProcessedMessages
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
  const mailScan = (await deps.getMailScan?.()) ?? DEFAULT_MAIL_SCAN_CONFIG

  const perSource: SyncSummary['perSource'] = []
  const failed: SourceId[] = []
  let inserted = 0
  let updated = 0

  // SEQUENTIAL over the registry order on purpose (PLAN.md §2): politeness
  // means no parallel hammering, ever.
  for (const provider of deps.providers) {
    // Stop requested mid-pass: leave the remaining providers untouched.
    if (deps.signal?.aborted) break
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
      // Incremental saves during a long fetch, so a crash mid-run keeps the
      // work already done. Their counts fold into this source's totals.
      let incremental = { inserted: 0, updated: 0 }
      const ctx: FetchContext = {
        http: deps.createHttp(meta),
        config: await deps.readConfig(meta.id),
        searchProfile,
        logger,
        createMail: deps.createMail,
        llm: deps.llm,
        mailScan,
        trace: deps.trace,
        signal: deps.signal,
        isPaused: deps.isPaused,
        waitForResume: deps.waitForResume,
        processedMessages: deps.processedMessages,
        saveJobs: async (batch) => {
          const dedup = [...new Map(batch.map((job) => [job.id, job])).values()]
          if (dedup.length === 0) return { inserted: 0, updated: 0 }
          const saved = await upsertJobs(db, dedup, nowIso)
          incremental = {
            inserted: incremental.inserted + saved.inserted,
            updated: incremental.updated + saved.updated,
          }
          return saved
        },
      }
      const payloads = await provider.fetch(ctx)
      const jobs = payloads.flatMap((payload) => provider.parse(payload, ctx))
      // Batch-level id dedupe (the same job can appear on two pages of one
      // fetch); last occurrence wins, matching upsertJobs semantics.
      const unique = [...new Map(jobs.map((job) => [job.id, job])).values()]
      const final = await upsertJobs(db, unique, nowIso)
      // Providers that saved incrementally return an empty payload, so the
      // final upsert is a no-op and the totals come from the incremental saves.
      const counts = {
        inserted: final.inserted + incremental.inserted,
        updated: final.updated + incremental.updated,
      }
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
      const message = describeError(error)
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
      // Surface the failure in the agent timeline too — without this row a
      // crashed provider looks like a run that quietly finished (the error
      // only reached sync_runs / the Sources page, not the panel being
      // watched). The label's "failed" tones the dot red; the body carries the
      // full error as an expandable row.
      deps.trace?.({
        channel: 'sync',
        label: `${meta.displayName} failed — sync aborted for this source`,
        status: 'failed',
        body: message,
      })
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
