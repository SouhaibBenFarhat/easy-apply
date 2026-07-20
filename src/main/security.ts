import type { BrowserWindow } from 'electron'
import { app, session, shell } from 'electron'

const ALLOWED_EXTERNAL = new Set(['http:', 'https:', 'mailto:'])

function openExternally(url: string): void {
  try {
    const protocol = new URL(url).protocol
    if (ALLOWED_EXTERNAL.has(protocol)) void shell.openExternal(url)
  } catch {
    // Malformed URL — drop it.
  }
}

// PLAN.md §4.9: deny-all window opens, no in-app navigation, http(s) links go
// to the OS browser. Job descriptions are hostile input.
export function installWindowGuards(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternally(url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (url === window.webContents.getURL()) return
    event.preventDefault()
    openExternally(url)
  })
}

// Strict CSP in the packaged app only — electron-vite dev needs HMR websockets
// and inline modules. All network I/O lives in the main process, so the
// renderer's connect-src stays 'self'.
export function installContentSecurityPolicy(): void {
  if (!app.isPackaged) return
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
  ].join('; ')

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    })
  })
}
