import { join } from 'node:path'
import { type AppDatabase, createDatabase } from '@persistence/main'
import { app, BrowserWindow } from 'electron'
import { registerDbIpc } from './ipc/db'
import { registerSettingsIpc } from './ipc/settings'
import { registerSourcesIpc } from './ipc/sources'
import { installMenu } from './menu'
import { installContentSecurityPolicy, installWindowGuards } from './security'
import { store } from './store'

// Kept intentionally thin (PLAN.md §4.1): window/lifecycle/menu/security and
// persistence wiring here; the sync engine arrives in PR 9.

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
