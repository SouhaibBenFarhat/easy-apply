import type { IpcResult } from '@sources/shared'

// The bridge convention: IPC errors are values ({ success: false, error }),
// never exceptions across the contextBridge. Query/mutation functions unwrap
// here and THROW on failure so react-query's error states (isError, error,
// retry, rollback) work off the same convention everywhere.
export function unwrap<T>(result: IpcResult<T>): T {
  if (!result.success) throw new Error(result.error)
  return result.data
}
