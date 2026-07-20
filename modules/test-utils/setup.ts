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
  localStorage.clear()
  setupMockElectron()
})
