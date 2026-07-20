import { contextBridge, ipcRenderer } from 'electron'

// The typed bridge surface. Every member is declared in electron-api.d.ts and
// every invoke channel resolves to { success, data? , error? } (IpcResult).
const api = {
  platform: process.platform,
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (update: unknown) => ipcRenderer.invoke('settings:set', update),
  },
}

contextBridge.exposeInMainWorld('electron', api)
