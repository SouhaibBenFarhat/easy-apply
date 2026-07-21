import { act, createTestQueryClient, renderHook, waitFor } from '@test-utils'
import type { AppSettings } from '../../../src/preload/electron-api'
import { keys } from '../keys'
import { useSetAppSettings } from './settings'

describe('useSetAppSettings', () => {
  it('writes the merged settings into the cache and invalidates', async () => {
    const client = createTestQueryClient()
    const { result } = renderHook(() => useSetAppSettings(), { client })
    act(() => {
      result.current.mutate({ syncIntervalHours: 6 })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const cached = client.getQueryData<AppSettings>(keys.settings.app)
    expect(cached?.syncIntervalHours).toBe(6)
    expect(cached?.searchProfile.city).toBe('München')
    expect(client.getQueryState(keys.settings.app)?.isInvalidated).toBe(true)
  })

  it('surfaces an IpcResult failure as a mutation error', async () => {
    vi.spyOn(window.electron.settings, 'set').mockResolvedValue({
      success: false,
      error: 'radiusKm: too large',
    })
    const { result } = renderHook(() => useSetAppSettings())
    act(() => {
      result.current.mutate({ syncIntervalHours: 6 })
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('radiusKm: too large')
  })
})
