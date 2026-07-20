// Hand-maintained contract between preload (implementation) and renderer
// (consumer). Every channel added in src/preload/index.ts must be declared
// here; the renderer only ever touches `window.electron`.

export interface ElectronAPI {
  readonly platform: NodeJS.Platform
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
