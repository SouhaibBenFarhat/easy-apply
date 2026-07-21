import { renderHook, waitFor } from '@test-utils'
import { useCancelModelDownload, useDownloadModel, useSetModelEnabled } from './model'

describe('useDownloadModel', () => {
  it('starts the download and resolves a downloading status', async () => {
    const { result } = renderHook(() => useDownloadModel())
    result.current.mutate()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.state).toBe('downloading')
  })

  it('surfaces an IpcResult failure as a mutation error', async () => {
    vi.spyOn(window.electron.model, 'download').mockResolvedValue({
      success: false,
      error: 'already running',
    })
    const { result } = renderHook(() => useDownloadModel())
    result.current.mutate()
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('already running')
  })
})

describe('useCancelModelDownload', () => {
  it('cancels and resolves an absent status', async () => {
    const { result } = renderHook(() => useCancelModelDownload())
    result.current.mutate()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.state).toBe('absent')
  })
})

describe('useSetModelEnabled', () => {
  it('toggles AI off and resolves the disabled status', async () => {
    const { result } = renderHook(() => useSetModelEnabled())
    result.current.mutate(false)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.enabled).toBe(false)
  })
})
