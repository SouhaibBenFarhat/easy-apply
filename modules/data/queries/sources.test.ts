import { renderHook, waitFor } from '@test-utils'
import { useSources } from './sources'

describe('useSources', () => {
  it('resolves the source list from the bridge', async () => {
    const { result } = renderHook(() => useSources())
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const ids = result.current.data?.map((info) => info.sourceId)
    expect(ids).toContain('ba')
    expect(ids).toContain('himalayas')
    expect(ids).toContain('mailbox')
    expect(result.current.data?.length).toBe(6)
  })

  it('surfaces an IpcResult failure as a query error', async () => {
    vi.spyOn(window.electron.sources, 'list').mockResolvedValue({
      success: false,
      error: 'registry unavailable',
    })
    const { result } = renderHook(() => useSources())
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('registry unavailable')
  })
})
