import { join } from 'node:path'
import { createLogger } from '@logger/main'
import { type AppDatabase, createDatabase } from '@persistence/main'
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
  registerDbIpc(db)
  registerSourcesIpc(db)
  registerMailboxIpc(db)
  const modelManager = new ModelManager(undefined, store.get('modelId'))
  // Seed the persisted AI on/off preference (nothing is loaded yet, so no
  // dispose happens here).
  await modelManager.setAiEnabled(store.get('aiEnabled'))
  // installSync returns a stop handle so turning AI off also aborts a run.
  const stopSync = installSync(db, modelManager)
  registerModelIpc(modelManager, stopSync)
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  void db?.close()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
