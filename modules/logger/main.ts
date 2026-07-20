// L0 — main-process logger. Same surface as the renderer logger; file-based
// transport can be added later without touching call sites.

export type { LogCategory, Logger } from './index'
export { createLogger } from './index'
