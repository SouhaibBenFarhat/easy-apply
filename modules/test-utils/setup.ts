import '@testing-library/jest-dom/vitest'
import { setupMockElectron } from './mocks/electron'

// happy-dom lacks ResizeObserver; several Radix primitives need it.
class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver

beforeEach(() => {
  // Node-environment suites (e.g. modules/persistence, which runs PGlite via
  // `@vitest-environment node`) have no DOM to reset.
  if (typeof window === 'undefined') return
  localStorage.clear()
  setupMockElectron()
})
