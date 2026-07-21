import { createLogger } from '@logger/main'
import type { AppDatabase, SyncRun } from '@persistence/main'
import { listRecentSyncRuns } from '@persistence/main'
import type { AgentTraceInput, LlmClient, SyncEvent, SyncSummary } from '@sources/main'
import { PoliteHttpClient, PROVIDERS, runSync } from '@sources/main'
import type { IpcResult } from '@sources/shared'
import { fail, ok, resolveSearchProfile } from '@sources/shared'
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

const FIRST_SYNC_DELAY_MS = 5_000
// The scheduler wakes every 30 min and only runs a pass once the configured
// syncIntervalHours has elapsed since the last completed one.
const SCHEDULER_TICK_MS = 30 * 60_000
// Slightly above the client default (1 s): sync is background traffic, it can
// afford to be extra polite.
const SYNC_REQUEST_GAP_MS = 1_200

export function installSync(db: AppDatabase, modelManager: ModelManager): void {
  const logger = createLogger('sync')
  // Single-flight guard: one sync pass at a time, manual or scheduled.
  let running: Promise<SyncSummary> | null = null
  let lastCompletedAt: string | null = null

  const broadcast = (event: SyncEvent): void => {
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('sync:event', event)
  }

  // Live agent-activity trace for the header monitor: stamp seq/at and push to
  // every window over 'agent:trace'.
  let traceSeq = 0
  const traceEmit = (input: AgentTraceInput): void => {
    const event = { seq: traceSeq++, at: new Date().toISOString(), ...input }
    for (const window of BrowserWindow.getAllWindows())
      window.webContents.send('agent:trace', event)
  }

  // Wrap the LLM so every extraction call surfaces its prompt (the context) and
  // response in the trace — the thing that makes the agent visible.
  const traced = (inner: LlmClient): LlmClient => ({
    complete: async (prompt: string): Promise<string> => {
      traceEmit({
        channel: 'llm',
        label: `Prompt · ${prompt.length} chars`,
        body: prompt,
        chars: prompt.length,
      })
      const response = await inner.complete(prompt)
      traceEmit({
        channel: 'llm',
        label: `Response · ${response.length} chars`,
        body: response,
        chars: response.length,
      })
      return response
    },
  })

  const start = (force: boolean): Promise<SyncSummary> => {
    const promise = (async (): Promise<SyncSummary> => {
      // The manager gives us the loaded LLM only when AI is on AND the model is
      // downloaded; null otherwise (off → RAM stays free, model skipped).
      const rawLlm = await modelManager.resolveLlm(createLlamaClient)
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
        },
        // Manual "Sync now" forces past the per-provider minInterval — the user
        // asked explicitly; only the automatic scheduler stays polite.
        { force },
      )
    })()
    running = promise
    promise
      .then((summary) => {
        lastCompletedAt = summary.finishedAt
        traceEmit({
          channel: 'sync',
          label: `Sync finished · +${summary.inserted} new, ${summary.updated} updated`,
        })
      })
      .catch((error: unknown) => {
        logger.error(`sync pass crashed: ${error instanceof Error ? error.message : String(error)}`)
      })
      .finally(() => {
        running = null
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
}
