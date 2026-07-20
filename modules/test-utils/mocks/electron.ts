import type { ElectronAPI } from '../../../src/preload/electron-api'

// Full window.electron mock surface. Grown alongside the real preload bridge
// (PRs 3–10) so component tests never touch real IPC.
export function createMockElectron(): ElectronAPI {
  return {
    platform: 'darwin',
  }
}

export function setupMockElectron(overrides: Partial<ElectronAPI> = {}): ElectronAPI {
  const mock = { ...createMockElectron(), ...overrides }
  Object.defineProperty(window, 'electron', { value: mock, writable: true, configurable: true })
  return mock
}
