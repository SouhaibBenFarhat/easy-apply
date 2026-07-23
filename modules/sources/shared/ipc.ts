import { describeError } from './errors'

// The IPC response convention — every invoke channel resolves to this shape;
// errors are values, never thrown across the bridge.
export type IpcResult<T> = { success: true; data: T } | { success: false; error: string }

export function ok<T>(data: T): IpcResult<T> {
  return { success: true, data }
}

export function fail<T>(error: unknown): IpcResult<T> {
  // describeError, not error.message: wrapper libraries hide the real reason in
  // `cause`, and an error that reaches the UI must be able to explain itself.
  return { success: false, error: describeError(error) }
}
