import { contextBridge } from 'electron'

// The typed bridge surface. Grown in PRs 3–10; every member is declared in
// electron-api.d.ts and every response follows { success, data?, error? }.
const api = {
  platform: process.platform,
}

contextBridge.exposeInMainWorld('electron', api)
