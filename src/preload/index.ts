import type { IpcRendererEvent } from 'electron'
import { contextBridge, ipcRenderer } from 'electron'

// The typed bridge surface. Every member is declared in electron-api.d.ts and
// every invoke channel resolves to { success, data? , error? } (IpcResult).
const api = {
  platform: process.platform,
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (update: unknown) => ipcRenderer.invoke('settings:set', update),
  },
  db: {
    jobs: {
      list: (filters?: unknown) => ipcRenderer.invoke('db:jobs:list', filters),
      get: (id: string) => ipcRenderer.invoke('db:jobs:get', id),
      setStatus: (id: string, status: unknown) =>
        ipcRenderer.invoke('db:jobs:set-status', id, status),
      setNotes: (id: string, notes: unknown) => ipcRenderer.invoke('db:jobs:set-notes', id, notes),
      setHidden: (id: string, hidden: boolean) =>
        ipcRenderer.invoke('db:jobs:set-hidden', id, hidden),
    },
    providers: {
      list: () => ipcRenderer.invoke('db:providers:list'),
      setEnabled: (sourceId: string, enabled: boolean) =>
        ipcRenderer.invoke('db:providers:set-enabled', sourceId, enabled),
    },
  },
  sources: {
    list: () => ipcRenderer.invoke('sources:list'),
    setEnabled: (sourceId: string, enabled: boolean) =>
      ipcRenderer.invoke('sources:set-enabled', { sourceId, enabled }),
    setKey: (sourceId: string, values: Record<string, string>) =>
      ipcRenderer.invoke('sources:set-key', { sourceId, values }),
    clearKey: (sourceId: string) => ipcRenderer.invoke('sources:clear-key', { sourceId }),
  },
  sync: {
    now: () => ipcRenderer.invoke('sync:now'),
    status: () => ipcRenderer.invoke('sync:status'),
    // Push events (webContents.send('sync:event', …)) → subscription with an
    // unsubscribe closure, the house convention for main→renderer pushes.
    onEvent: (callback: (event: unknown) => void) => {
      const listener = (_event: IpcRendererEvent, payload: unknown): void => callback(payload)
      ipcRenderer.on('sync:event', listener)
      return () => {
        ipcRenderer.removeListener('sync:event', listener)
      }
    },
  },
}

contextBridge.exposeInMainWorld('electron', api)
