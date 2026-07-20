// The IPC response convention — every invoke channel resolves to this shape;
// errors are values, never thrown across the bridge.
export type IpcResult<T> = { success: true; data: T } | { success: false; error: string }

export function ok<T>(data: T): IpcResult<T> {
  return { success: true, data }
}

export function fail<T>(error: unknown): IpcResult<T> {
  return { success: false, error: error instanceof Error ? error.message : String(error) }
}
