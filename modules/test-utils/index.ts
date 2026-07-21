// L2 — test infrastructure. Imported only from *.test.{ts,tsx} files.

export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
export { createMockElectron, createSyncEventEmitter, setupMockElectron } from './mocks/electron'
export { render } from './render'
