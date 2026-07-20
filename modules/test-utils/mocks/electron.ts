import { DEFAULT_SEARCH_PROFILE } from '@sources/shared'
import type { AppSettings, ElectronAPI } from '../../../src/preload/electron-api'

// Full window.electron mock surface. Grown alongside the real preload bridge
// so component tests never touch real IPC.
export function createMockElectron(): ElectronAPI {
  const settings: AppSettings = {
    searchProfile: DEFAULT_SEARCH_PROFILE,
    syncIntervalHours: 3,
  }
  return {
    platform: 'darwin',
    settings: {
      get: async () => ({ success: true, data: settings }),
      set: async (update) => ({ success: true, data: { ...settings, ...update } }),
    },
  }
}

export function setupMockElectron(overrides: Partial<ElectronAPI> = {}): ElectronAPI {
  const mock = { ...createMockElectron(), ...overrides }
  Object.defineProperty(window, 'electron', { value: mock, writable: true, configurable: true })
  return mock
}
