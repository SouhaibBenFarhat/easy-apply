// L0 — shared logging surface (renderer-safe). No imports from app modules.

export type LogCategory = 'app' | 'data' | 'sync' | 'source' | 'db' | 'ipc' | 'ui' | 'llm'

export interface Logger {
  readonly debug: (message: string, meta?: Record<string, unknown>) => void
  readonly info: (message: string, meta?: Record<string, unknown>) => void
  readonly warn: (message: string, meta?: Record<string, unknown>) => void
  readonly error: (message: string, meta?: Record<string, unknown>) => void
}

const format = (category: LogCategory, message: string): string =>
  `[${new Date().toISOString()}] [${category}] ${message}`

export function createLogger(category: LogCategory): Logger {
  return {
    debug: (message, meta) => console.debug(format(category, message), meta ?? ''),
    info: (message, meta) => console.info(format(category, message), meta ?? ''),
    warn: (message, meta) => console.warn(format(category, message), meta ?? ''),
    error: (message, meta) => console.error(format(category, message), meta ?? ''),
  }
}
