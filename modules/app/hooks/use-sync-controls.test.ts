import { act, renderHook, waitFor } from '@test-utils'
import type { UseToastReturn } from '@ui-kit'
import { dismiss, useToast } from '@ui-kit'
import type { SyncControls } from './use-sync-controls'
import { useSyncControls } from './use-sync-controls'

afterEach(() => {
  const { result } = renderHook(() => useToast())
  act(() => {
    for (const item of [...result.current.toasts]) {
      dismiss(item.id)
    }
  })
})

function setup(): { current: { controls: SyncControls; toast: UseToastReturn } } {
  const { result } = renderHook(() => ({ controls: useSyncControls(), toast: useToast() }))
  return result
}

describe('useSyncControls', () => {
  it('is idle by default', async () => {
    const result = setup()
    await waitFor(() => expect(result.current.controls.syncing).toBe(false))
  })

  it('reports syncing while the engine has a pass running', async () => {
    vi.spyOn(window.electron.sync, 'status').mockResolvedValue({
      success: true,
      data: { running: true, lastCompletedAt: null, recentRuns: [] },
    })
    const result = setup()
    await waitFor(() => expect(result.current.controls.syncing).toBe(true))
  })

  it('runs a sync and toasts the summary line', async () => {
    const now = vi.spyOn(window.electron.sync, 'now').mockResolvedValue({
      success: true,
      data: {
        inserted: 3,
        updated: 1,
        perSource: [],
        startedAt: '2026-07-20T10:00:00.000Z',
        finishedAt: '2026-07-20T10:00:05.000Z',
      },
    })
    const result = setup()
    act(() => {
      result.current.controls.onSyncNow()
    })
    await waitFor(() => expect(now).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(result.current.toast.toasts).toContainEqual(
        expect.objectContaining({ title: 'Sync complete', description: '3 new jobs' }),
      ),
    )
  })

  it('toasts destructively when the sync fails', async () => {
    vi.spyOn(window.electron.sync, 'now').mockResolvedValue({
      success: false,
      error: 'network down',
    })
    const result = setup()
    act(() => {
      result.current.controls.onSyncNow()
    })
    await waitFor(() =>
      expect(result.current.toast.toasts).toContainEqual(
        expect.objectContaining({
          title: 'Sync failed',
          description: 'network down',
          variant: 'destructive',
        }),
      ),
    )
  })
})
