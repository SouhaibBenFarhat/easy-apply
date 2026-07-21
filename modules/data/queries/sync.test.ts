import { renderHook, waitFor } from '@test-utils'
import { useSyncStatus } from './sync'

describe('useSyncStatus', () => {
  it('resolves the sync status from the bridge', async () => {
    const { result } = renderHook(() => useSyncStatus())
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ running: false, lastCompletedAt: null, recentRuns: [] })
  })

  it('surfaces an IpcResult failure as a query error', async () => {
    vi.spyOn(window.electron.sync, 'status').mockResolvedValue({
      success: false,
      error: 'engine gone',
    })
    const { result } = renderHook(() => useSyncStatus())
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('engine gone')
  })
})
