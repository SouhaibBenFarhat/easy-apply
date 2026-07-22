import { act, createAgentStateEmitter, renderHook, waitFor } from '@test-utils'
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
    await waitFor(() => expect(result.current.controls.state).toBe('idle'))
  })

  // The state comes from the agent's own transport, NOT from
  // sync:status.running — a held pass still counts as running there, which is
  // exactly why the header kept spinning after a pause.
  it('reports the agent transport state, including a pause winding down', async () => {
    vi.spyOn(window.electron.agent, 'state').mockResolvedValue({
      success: true,
      data: 'pausing',
    })
    const result = setup()
    await waitFor(() => expect(result.current.controls.state).toBe('pausing'))
  })

  it('follows live transport pushes', async () => {
    const emit = createAgentStateEmitter(window.electron)
    const result = setup()
    await waitFor(() => expect(result.current.controls.state).toBe('idle'))

    act(() => emit('running'))
    await waitFor(() => expect(result.current.controls.state).toBe('running'))
    act(() => emit('paused'))
    await waitFor(() => expect(result.current.controls.state).toBe('paused'))
  })

  it('drives pause, resume and stop', async () => {
    const pause = vi.spyOn(window.electron.agent, 'pause')
    const resume = vi.spyOn(window.electron.agent, 'resume')
    const stop = vi.spyOn(window.electron.agent, 'stop')
    const result = setup()

    act(() => result.current.controls.onPause())
    await waitFor(() => expect(pause).toHaveBeenCalledTimes(1))
    act(() => result.current.controls.onResume())
    await waitFor(() => expect(resume).toHaveBeenCalledTimes(1))
    act(() => result.current.controls.onStop())
    await waitFor(() => expect(stop).toHaveBeenCalledTimes(1))
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
