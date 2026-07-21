// L2 — test infrastructure. Imported only from *.test.{ts,tsx} files.

export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
export {
  createAgentTraceEmitter,
  createMockElectron,
  createModelProgressEmitter,
  createSyncEventEmitter,
  setupMockElectron,
} from './mocks/electron'
// render/renderHook shadow the RTL exports above (explicit exports win over
// `export *`): both wrap in the app's providers with a fresh test client.
export {
  type AppRenderHookOptions,
  type AppRenderOptions,
  createTestQueryClient,
  render,
  renderHook,
} from './render'
