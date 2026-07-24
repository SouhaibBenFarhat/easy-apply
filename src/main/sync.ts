import { createLogger } from '@logger/main'
import type { AgentRunStep, AgentRunSummary, AppDatabase, SyncRun } from '@persistence/main'
import {
  appendAgentStep,
  finishAgentRun,
  getAgentRunSteps,
  listAgentRuns,
  listRecentSyncRuns,
  pruneAgentRuns,
  startAgentRun,
} from '@persistence/main'
import type {
  AgentPipelineStats,
  AgentTraceInput,
  LlmClient,
  SyncEvent,
  SyncSummary,
} from '@sources/main'
import { PoliteHttpClient, PROVIDERS, runSync, splitThinking } from '@sources/main'
import type { IpcResult } from '@sources/shared'
import {
  describeError,
  fail,
  ok,
  resolveMailScanConfig,
  resolveSearchProfile,
} from '@sources/shared'
import { app, BrowserWindow, ipcMain } from 'electron'
import { createLlamaClient } from './llm'
import { createImapMailDriver } from './mail-driver'
import type { ModelManager } from './model'
import { readProviderConfig } from './provider-config'
import { store } from './store'

// Electron glue around the pure engine (modules/sources/main/engine.ts):
// scheduler, single-flight guard, sync:* IPC, and renderer push events.
// Coverage-excluded like all src/main/** — the engine itself is fully tested.

// Mirrored in src/preload/electron-api.d.ts.
export interface SyncStatus {
  running: boolean
  lastCompletedAt: string | null
  recentRuns: SyncRun[]
}

// The agent's transport state — what the play/pause/stop controls render from.
// 'pausing' is the state that used to be invisible: the pause is requested, but
// the scan only holds BETWEEN emails, so a local model mid-generation can take
// minutes to reach the checkpoint. Without it the UI looked broken — the click
// did nothing observable until the in-flight email finished.
// Mirrored in src/preload/electron-api.d.ts.
export type AgentState = 'idle' | 'running' | 'pausing' | 'paused'

const FIRST_SYNC_DELAY_MS = 5_000
// The scheduler wakes every 30 min and only runs a pass once the configured
// syncIntervalHours has elapsed since the last completed one.
const SCHEDULER_TICK_MS = 30 * 60_000
// Slightly above the client default (1 s): sync is background traffic, it can
// afford to be extra polite.
const SYNC_REQUEST_GAP_MS = 1_200
// How many scanned-mail ids to remember (most-recent-wins) so the store doesn't
// grow without bound. ~30 days of mail fits comfortably.
const PROCESSED_MAIL_CAP = 5_000
// How many agent runs to keep in history — older runs (and their steps, which
// include full prompt/response bodies) are pruned after each pass.
const MAX_RUN_HISTORY = 50

export function installSync(db: AppDatabase, modelManager: ModelManager): () => void {
  const logger = createLogger('sync')
  // Single-flight guard: one sync pass at a time, manual or scheduled.
  let running: Promise<SyncSummary> | null = null
  let lastCompletedAt: string | null = null
  // The running pass's abort handle — the Stop button and AI-off abort through
  // it, halting the (slow) email scan between messages.
  let activeController: AbortController | null = null
  // Cooperative pause: the scan holds at waitForResume() until resume() (or a
  // Stop, which also releases waiters so the aborted run can exit).
  let paused = false
  let resumeWaiters: Array<() => void> = []
  const releaseResume = (): void => {
    const waiters = resumeWaiters
    resumeWaiters = []
    for (const resolve of waiters) resolve()
  }
  const waitForResume = (): Promise<void> =>
    paused ? new Promise<void>((resolve) => resumeWaiters.push(resolve)) : Promise.resolve()

  const broadcast = (event: SyncEvent): void => {
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('sync:event', event)
  }

  // Authoritative transport state. The renderer never derives this from timing
  // guesses — main knows when a pass starts, when a pause is merely REQUESTED,
  // and when the scan actually reached its checkpoint and held.
  let agentState: AgentState = 'idle'
  const setAgentState = (next: AgentState): void => {
    if (agentState === next) return
    agentState = next
    for (const window of BrowserWindow.getAllWindows())
      window.webContents.send('agent:state-changed', next)
  }

  // Live agent-activity trace for the header monitor: stamp seq/at and push to
  // every window over 'agent:trace'. seq restarts at 0 for every pass — the
  // renderer's collector treats a seq-0 event as "new run, wipe the timeline".
  let traceSeq = 0
  // The run this pass is being persisted under, and the latest funnel snapshot
  // seen — so the finished run row can report its email/job rollup. Both live
  // for the duration of one pass (set in start(), cleared when it settles).
  let currentRunId: number | null = null
  let lastRunStats: AgentPipelineStats | null = null
  const traceEmit = (input: AgentTraceInput): void => {
    // A funnel snapshot is the provider ACKNOWLEDGING the hold: it flips
    // stats.paused at the checkpoint, which is the only moment 'pausing' can
    // honestly become 'paused' (and the moment a resume takes effect).
    if (input.stats !== undefined && agentState !== 'idle') {
      if (input.stats.paused) setAgentState('paused')
      else if (agentState === 'paused') setAgentState('running')
    }
    if (input.stats !== undefined) lastRunStats = input.stats
    const event = { seq: traceSeq++, at: new Date().toISOString(), ...input }
    for (const window of BrowserWindow.getAllWindows())
      window.webContents.send('agent:trace', event)
    // Persist the step (best-effort). Fire-and-forget so the DB write never
    // stalls the live push; steps carry `seq`, so a slow insert still reads
    // back in order. A failed write must never crash a sync.
    if (currentRunId !== null) {
      const runId = currentRunId
      void appendAgentStep(db, runId, {
        seq: event.seq,
        at: event.at,
        channel: event.channel,
        label: event.label,
        status: event.status ?? null,
        chars: event.chars ?? null,
        durationMs: event.durationMs ?? null,
        body: event.body ?? null,
        stats: event.stats ?? null,
        jobs: event.jobs ?? null,
      }).catch((error: unknown) => logger.error(`persist step failed: ${describeError(error)}`))
    }
  }

  // Wrap the LLM so every extraction call surfaces its prompt (the context),
  // any reasoning, and the response in the trace — the thing that makes the
  // agent visible. Reasoning models return a <think>…</think> block; we split it
  // out so the "thinking" area shows it and the extractor parses clean output.
  const traced = (inner: LlmClient): LlmClient => ({
    complete: async (prompt: string, options): Promise<string> => {
      traceEmit({
        channel: 'llm',
        label: `Prompt · ${prompt.length} chars`,
        body: prompt,
        chars: prompt.length,
      })
      const startedAt = Date.now()
      const raw = await inner.complete(prompt, options)
      const durationMs = Date.now() - startedAt
      const { thinking, answer } = splitThinking(raw)
      if (thinking !== '') {
        traceEmit({
          channel: 'thinking',
          label: `Thinking · ${thinking.length} chars`,
          body: thinking,
          chars: thinking.length,
        })
      }
      // The whole generation (thinking included) settles on the Response row —
      // its Prompt row above marks the start.
      traceEmit({
        channel: 'llm',
        label: `Response · ${answer.length} chars`,
        body: answer,
        chars: answer.length,
        durationMs,
      })
      return answer
    },
  })

  const start = (force: boolean): Promise<SyncSummary> => {
    const controller = new AbortController()
    activeController = controller
    // A fresh pass never starts paused; clear any stale waiters.
    paused = false
    releaseResume()
    // Fresh pass, fresh timeline: this pass's first event carries seq 0.
    traceSeq = 0
    currentRunId = null
    lastRunStats = null
    setAgentState('running')
    // Scanned-mail memory for this pass, so the mailbox agent only LLMs new
    // mail; persisted (capped, most-recent-wins) after the pass settles.
    const seenMailIds = new Set(store.get('processedMailIds'))
    // Set when 'Sync started' is emitted — the pass's start marker, so the
    // finish row can report how long the whole pass took.
    let passStartedAt = Date.now()
    const promise = (async (): Promise<SyncSummary> => {
      // The manager gives us the loaded LLM only when AI is on AND the model is
      // downloaded; null otherwise (off → RAM stays free, model skipped).
      const rawLlm = await modelManager.resolveLlm(createLlamaClient)
      passStartedAt = Date.now()
      // Open the durable run row BEFORE the first step, so every step (from
      // 'Sync started' on) is persisted under it. A failure here just means
      // this pass isn't recorded — the live trace still works.
      try {
        currentRunId = await startAgentRun(db, {
          trigger: force ? 'manual' : 'scheduled',
          startedAt: new Date(passStartedAt).toISOString(),
        })
      } catch (error) {
        currentRunId = null
        logger.error(`open run failed: ${describeError(error)}`)
      }
      traceEmit({
        channel: 'sync',
        label: force ? 'Sync started (manual)' : 'Sync started',
      })
      return runSync(
        {
          db,
          providers: PROVIDERS,
          readConfig: (sourceId) => readProviderConfig(db, sourceId),
          getSearchProfile: async () => resolveSearchProfile(store.get('searchProfile')),
          getMailScan: async () => resolveMailScanConfig(store.get('mailScan')),
          // A fresh client per provider: each source gets its own request
          // spacing window, and no throttle state leaks across sources.
          createHttp: () => new PoliteHttpClient({ minRequestGapMs: SYNC_REQUEST_GAP_MS }),
          logger,
          emit: broadcast,
          // Email-ingestion runtime for the mailbox provider. The IMAP factory
          // is always available; the LLM only when on + installed.
          createMail: createImapMailDriver,
          llm: rawLlm === null ? undefined : traced(rawLlm),
          trace: traceEmit,
          signal: controller.signal,
          isPaused: () => paused,
          waitForResume,
          processedMessages: {
            has: (id) => seenMailIds.has(id),
            // Persist on EVERY add (not just at pass end), so a mid-scan restart
            // — e.g. dev hot-reload — resumes instead of re-scanning from the
            // start. Cheap relative to the per-email LLM call.
            add: (id) => {
              seenMailIds.add(id)
              store.set('processedMailIds', [...seenMailIds].slice(-PROCESSED_MAIL_CAP))
            },
          },
        },
        // Manual "Sync now" forces past the per-provider minInterval — the user
        // asked explicitly; only the automatic scheduler stays polite.
        { force },
      )
    })()
    running = promise
    // Close the run row to match how the pass actually ended, then prune old
    // history. All best-effort: a failed record keeps the sync itself intact.
    const closeRun = async (
      status: 'completed' | 'stopped' | 'failed',
      error?: string,
    ): Promise<void> => {
      const runId = currentRunId
      if (runId === null) return
      try {
        await finishAgentRun(db, runId, {
          status,
          finishedAt: new Date().toISOString(),
          emailsTotal: lastRunStats?.emailsTotal ?? 0,
          emailsProcessed: lastRunStats?.emailsProcessed ?? 0,
          jobsKept: lastRunStats?.jobsKept ?? 0,
          error: error ?? null,
        })
        await pruneAgentRuns(db, MAX_RUN_HISTORY)
      } catch (persistError) {
        logger.error(`close run failed: ${describeError(persistError)}`)
      }
    }
    promise
      .then(async (summary) => {
        lastCompletedAt = summary.finishedAt
        traceEmit({
          channel: 'sync',
          label: `Sync finished · +${summary.inserted} new, ${summary.updated} updated`,
          durationMs: Date.now() - passStartedAt,
        })
        // A pass that returned but was aborted mid-scan is a stop, not a
        // completion — the transport state is the authority.
        await closeRun(controller.signal.aborted ? 'stopped' : 'completed')
      })
      .catch(async (error: unknown) => {
        logger.error(`sync pass crashed: ${describeError(error)}`)
        await closeRun('failed', describeError(error))
      })
      .finally(() => {
        running = null
        if (activeController === controller) activeController = null
        paused = false
        releaseResume()
        currentRunId = null
        setAgentState('idle')
      })
    return promise
  }

  const tick = (): void => {
    if (running !== null) return
    const intervalMs = store.get('syncIntervalHours') * 3_600_000
    if (lastCompletedAt !== null && Date.now() - Date.parse(lastCompletedAt) < intervalMs) return
    void start(false)
  }

  const firstRun = setTimeout(() => {
    if (running === null) void start(false)
  }, FIRST_SYNC_DELAY_MS)
  const scheduler = setInterval(tick, SCHEDULER_TICK_MS)

  app.on('before-quit', () => {
    clearTimeout(firstRun)
    clearInterval(scheduler)
  })

  ipcMain.handle('sync:now', async (): Promise<IpcResult<SyncSummary>> => {
    try {
      if (running !== null) return fail('sync already running')
      return ok(await start(true))
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle('sync:status', async (): Promise<IpcResult<SyncStatus>> => {
    try {
      return ok({
        running: running !== null,
        lastCompletedAt,
        recentRuns: await listRecentSyncRuns(db),
      })
    } catch (error) {
      return fail(error)
    }
  })

  // Current transport state — read once on mount; live changes arrive over the
  // 'agent:state-changed' push, so a reopened panel or reloaded window is never
  // out of step with a pass that is already under way.
  ipcMain.handle('agent:state', async (): Promise<IpcResult<AgentState>> => {
    try {
      return ok(agentState)
    } catch (error) {
      return fail(error)
    }
  })

  // Interrupt the running pass (the email scan). Resolves true if a pass was
  // actually aborted, false if nothing was running.
  ipcMain.handle('agent:stop', async (): Promise<IpcResult<boolean>> => {
    try {
      const wasRunning = activeController !== null
      if (wasRunning) traceEmit({ channel: 'sync', label: 'Stopping' })
      // Release a paused scan so it wakes, sees the abort, and exits cleanly.
      paused = false
      releaseResume()
      activeController?.abort()
      return ok(wasRunning)
    } catch (error) {
      return fail(error)
    }
  })

  // Hold the running scan between emails. Resolves true if it actually paused.
  ipcMain.handle('agent:pause', async (): Promise<IpcResult<boolean>> => {
    try {
      if (running === null || paused) return ok(false)
      paused = true
      // 'pausing', not 'paused': the scan holds only at the next checkpoint.
      // The control flips immediately so the click is acknowledged, and the
      // funnel snapshot promotes it to 'paused' when the hold really happens.
      setAgentState('pausing')
      // Say what actually happens. "Pause requested" reads like the click
      // failed; the scan is genuinely still working until the next checkpoint.
      traceEmit({ channel: 'sync', label: 'Pausing — holds after the current email' })
      return ok(true)
    } catch (error) {
      return fail(error)
    }
  })

  // Resume a paused scan from exactly where it held.
  ipcMain.handle('agent:resume', async (): Promise<IpcResult<boolean>> => {
    try {
      if (!paused) return ok(false)
      paused = false
      releaseResume()
      // Covers resuming out of 'pausing' too — a pause that hadn't yet reached
      // its checkpoint is simply cancelled, and no snapshot ever arrives.
      setAgentState('running')
      traceEmit({ channel: 'sync', label: 'Resuming' })
      return ok(true)
    } catch (error) {
      return fail(error)
    }
  })

  // Persisted run history for the Runs page. The list is summaries; steps are
  // loaded per run, and come back shaped exactly like the live AgentTraceEvent
  // so the page renders a past run with the same timeline components.
  ipcMain.handle('agent:runs:list', async (): Promise<IpcResult<AgentRunSummary[]>> => {
    try {
      return ok(await listAgentRuns(db, MAX_RUN_HISTORY))
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(
    'agent:run:steps',
    async (_event, runId: unknown): Promise<IpcResult<AgentRunStep[]>> => {
      try {
        if (typeof runId !== 'number' || !Number.isInteger(runId))
          return fail('runId must be an integer')
        return ok(await getAgentRunSteps(db, runId))
      } catch (error) {
        return fail(error)
      }
    },
  )

  // Let callers (e.g. turning AI off, or app quit) abort a running pass too —
  // release any paused waiters first so the loop can exit, then AWAIT the pass
  // actually unwinding. Quit disposes the native model right after this returns,
  // and disposing a llama context while a generation is still in flight aborts
  // the process (SIGABRT). AI-off callers can ignore the promise.
  return async () => {
    paused = false
    releaseResume()
    activeController?.abort()
    await running?.catch(() => {})
  }
}
