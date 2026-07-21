import { act, createTestQueryClient, renderHook, waitFor } from '@test-utils'
import { keys } from '../keys'
import { useSyncNow } from './sync'

describe('useSyncNow', () => {
  it('resolves the summary and invalidates jobs + sync status', async () => {
    const client = createTestQueryClient()
    client.setQueryData(keys.jobs.feed({}), [])
    client.setQueryData(keys.sync.status, { running: false, lastCompletedAt: null, recentRuns: [] })
    client.setQueryData(keys.sources.list, [])

    const { result } = renderHook(() => useSyncNow(), { client })
    act(() => {
      result.current.mutate()
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.inserted).toBe(0)
    expect(client.getQueryState(keys.jobs.feed({}))?.isInvalidated).toBe(true)
    expect(client.getQueryState(keys.sync.status)?.isInvalidated).toBe(true)
    expect(client.getQueryState(keys.sources.list)?.isInvalidated).toBe(false)
  })

  it('surfaces an IpcResult failure as a mutation error', async () => {
    vi.spyOn(window.electron.sync, 'now').mockResolvedValue({
      success: false,
      error: 'already running',
    })
    const { result } = renderHook(() => useSyncNow())
    act(() => {
      result.current.mutate()
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('already running')
  })
})
