import { join } from 'node:path'
import { createLogger } from '@logger/main'
import { type AppDatabase, createDatabase, reconcileStaleRuns } from '@persistence/main'
import { app, BrowserWindow } from 'electron'
import { registerDbIpc } from './ipc/db'
import { registerMailboxIpc } from './ipc/mailbox'
import { registerModelIpc } from './ipc/model'
import { registerSettingsIpc } from './ipc/settings'
import { registerSourcesIpc } from './ipc/sources'
import { installMenu } from './menu'
import { ModelManager } from './model'
import { installContentSecurityPolicy, installWindowGuards } from './security'
import { store } from './store'
import { installSync } from './sync'

// Kept intentionally thin (PLAN.md §4.1): window/lifecycle/menu/security,
// persistence wiring, and the sync scheduler installation.

const logger = createLogger('app')

// Safety net: a background socket (IMAP) can emit a late error after the awaited
// call has already returned, and Electron's default handler would pop a crash
// dialog. Every real code path handles failures as values, so log and keep
// running rather than taking the whole app down over a stray timeout.
process.on('uncaughtException', (error) => {
  logger.error(
    `uncaught exception: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
  )
})
process.on('unhandledRejection', (reason) => {
  logger.error(
    `unhandled rejection: ${reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)}`,
  )
})

let db: AppDatabase | undefined
let modelManager: ModelManager | undefined
let stopSync: (() => void | Promise<void>) | undefined
// True once graceful shutdown has run, so the re-fired quit isn't intercepted.
let didShutdown = false

// Ordered teardown before the process exits. WITHOUT this, quit killed the
// process while a llama generation was mid-flight (native SIGABRT — the
// "Electron quit unexpectedly" dialog) and while PGlite was mid-write (a
// half-written index = the jobs_pkey corruption). Order matters: stop the run
// and let it unwind, unload the native model, THEN flush and close the DB.
async function gracefulShutdown(): Promise<void> {
  try {
    await stopSync?.()
  } catch (error) {
    logger.error(`shutdown: stopSync failed — ${String(error)}`)
  }
  try {
    await modelManager?.unloadLlm()
  } catch (error) {
    logger.error(`shutdown: model unload failed — ${String(error)}`)
  }
  try {
    await db?.close()
  } catch (error) {
    logger.error(`shutdown: db close failed — ${String(error)}`)
  }
}

function createWindow(): void {
  const bounds = store.get('windowBounds')
  const window = new BrowserWindow({
    ...bounds,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 18 },
    // Matches dark --background so there is no white flash on launch.
    backgroundColor: '#191d21',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  window.on('ready-to-show', () => window.show())
  window.on('close', () => {
    store.set('windowBounds', window.getBounds())
  })

  installWindowGuards(window)

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  // Dev runs the stock Electron binary, whose Dock icon is Electron's — the
  // real icon is only baked into the bundle at packaging time.
  if (!app.isPackaged && process.platform === 'darwin') {
    app.dock?.setIcon(join(app.getAppPath(), 'build/icon-1024.png'))
  }
  installContentSecurityPolicy()
  installMenu()
  registerSettingsIpc()
  // Dev vs packaged migrations path — the classic Electron trap (PLAN.md §4.5):
  // packaged builds read the drizzle/ folder shipped via extraResources.
  db = await createDatabase({
    dataDir: join(app.getPath('userData'), 'easyapply-db'),
    migrationsFolder: app.isPackaged
      ? join(process.resourcesPath, 'drizzle')
      : join(app.getAppPath(), 'drizzle'),
  })
  // Any run still 'running' from a previous launch is a process that died
  // mid-pass (crash, kill, quit) — mark it stopped so history stays honest.
  await reconcileStaleRuns(db).catch((error) =>
    logger.error(`reconcile stale runs failed: ${String(error)}`),
  )
  registerDbIpc(db)
  registerSourcesIpc(db)
  registerMailboxIpc(db)
  modelManager = new ModelManager(undefined, store.get('modelId'))
  // Seed the persisted AI on/off preference (nothing is loaded yet, so no
  // dispose happens here).
  await modelManager.setAiEnabled(store.get('aiEnabled'))
  // installSync returns a stop handle so turning AI off also aborts a run.
  stopSync = installSync(db, modelManager)
  registerModelIpc(modelManager, stopSync)
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Intercept the FIRST quit, run the ordered async teardown, then really exit.
// app.exit(0) skips the rest of the lifecycle so no native code is torn down
// twice — the clean shutdown has already happened.
// A generation that ignores the abort must not hang the quit forever. Bound the
// whole teardown; the DB close is last and fast, so this only ever cuts off a
// wedged native call.
const SHUTDOWN_TIMEOUT_MS = 10_000

app.on('before-quit', (event) => {
  if (didShutdown) return
  event.preventDefault()
  didShutdown = true
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, SHUTDOWN_TIMEOUT_MS))
  void Promise.race([gracefulShutdown(), timeout]).finally(() => app.exit(0))
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
