import { renderHook, waitFor } from '@test-utils'
import { useAppSettings } from './settings'

describe('useAppSettings', () => {
  it('resolves the app settings from the bridge', async () => {
    const { result } = renderHook(() => useAppSettings())
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.syncIntervalHours).toBe(3)
    expect(result.current.data?.searchProfile.city).toBe('München')
  })

  it('surfaces an IpcResult failure as a query error', async () => {
    vi.spyOn(window.electron.settings, 'get').mockResolvedValue({
      success: false,
      error: 'store corrupted',
    })
    const { result } = renderHook(() => useAppSettings())
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('store corrupted')
  })
})
