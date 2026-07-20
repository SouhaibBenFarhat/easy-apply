// Hand-maintained contract between preload (implementation) and renderer
// (consumer). Every channel added in src/preload/index.ts must be declared
// here; the renderer only ever touches `window.electron`.
import type { IpcResult, SearchProfile } from '../../modules/sources/shared'

export interface AppSettings {
  searchProfile: SearchProfile
  syncIntervalHours: number
}

export interface ElectronAPI {
  readonly platform: NodeJS.Platform
  readonly settings: {
    readonly get: () => Promise<IpcResult<AppSettings>>
    readonly set: (update: Partial<AppSettings>) => Promise<IpcResult<AppSettings>>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
