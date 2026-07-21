import { renderHook, waitFor } from '@test-utils'
import { useModelStatus } from './model'

describe('useModelStatus', () => {
  it('resolves the model status from the bridge', async () => {
    const { result } = renderHook(() => useModelStatus())
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.state).toBe('absent')
    expect(result.current.data?.modelId).toBe('llama-3.1-8b-instruct-q4')
  })

  it('surfaces an IpcResult failure as a query error', async () => {
    vi.spyOn(window.electron.model, 'status').mockResolvedValue({
      success: false,
      error: 'model manager unavailable',
    })
    const { result } = renderHook(() => useModelStatus())
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('model manager unavailable')
  })
})
