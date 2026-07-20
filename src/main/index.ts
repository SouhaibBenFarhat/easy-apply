import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { registerSettingsIpc } from './ipc/settings'
import { installMenu } from './menu'
import { installContentSecurityPolicy, installWindowGuards } from './security'
import { store } from './store'

// Kept intentionally thin (PLAN.md §4.1): window/lifecycle/menu/security here;
// sync engine and persistence IPC arrive in PRs 4–9.

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

app.whenReady().then(() => {
  installContentSecurityPolicy()
  installMenu()
  registerSettingsIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
