import { act, createSyncEventEmitter, createTestQueryClient, renderHook } from '@test-utils'
import type { SyncEvent } from '../../../src/preload/electron-api'
import { keys } from '../keys'
import { useSyncEventInvalidation, useSyncEvents } from './use-sync-events'

const completed: SyncEvent = {
  type: 'sync:completed',
  inserted: 14,
  updated: 3,
  failed: [],
  finishedAt: '2026-07-20T10:00:00.000Z',
}

describe('useSyncEventInvalidation', () => {
  it('invalidates jobs, sync status and sources on sync:completed', () => {
    const emit = createSyncEventEmitter(window.electron)
    const client = createTestQueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    renderHook(() => useSyncEventInvalidation(), { client })

    act(() => {
      emit(completed)
    })

    expect(spy).toHaveBeenCalledWith({ queryKey: keys.jobs.all })
    expect(spy).toHaveBeenCalledWith({ queryKey: keys.sync.status })
    expect(spy).toHaveBeenCalledWith({ queryKey: keys.sources.list })
    expect(spy).toHaveBeenCalledTimes(3)
  })

  it('ignores non-completed events', () => {
    const emit = createSyncEventEmitter(window.electron)
    const client = createTestQueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    renderHook(() => useSyncEventInvalidation(), { client })

    act(() => {
      emit({ type: 'sync:started', startedAt: '2026-07-20T09:59:00.000Z' })
      emit({ type: 'source:started', sourceId: 'ba' })
    })

    expect(spy).not.toHaveBeenCalled()
  })

  it('unsubscribes on unmount', () => {
    const emit = createSyncEventEmitter(window.electron)
    const client = createTestQueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    const { unmount } = renderHook(() => useSyncEventInvalidation(), { client })

    unmount()
    act(() => {
      emit(completed)
    })

    expect(spy).not.toHaveBeenCalled()
  })
})

describe('useSyncEvents', () => {
  it('delivers every event to the handler', () => {
    const emit = createSyncEventEmitter(window.electron)
    const handler = vi.fn()
    renderHook(() => useSyncEvents(handler))

    act(() => {
      emit({ type: 'source:started', sourceId: 'ba' })
      emit(completed)
    })

    expect(handler).toHaveBeenCalledTimes(2)
    expect(handler).toHaveBeenNthCalledWith(1, { type: 'source:started', sourceId: 'ba' })
    expect(handler).toHaveBeenNthCalledWith(2, completed)
  })

  it('always calls the latest handler without resubscribing', () => {
    const emit = createSyncEventEmitter(window.electron)
    const subscribeSpy = vi.spyOn(window.electron.sync, 'onEvent')
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ handler }) => useSyncEvents(handler), {
      initialProps: { handler: first },
    })

    rerender({ handler: second })
    act(() => {
      emit(completed)
    })

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith(completed)
    expect(subscribeSpy).toHaveBeenCalledTimes(1) // mount only — rerender did not resubscribe
  })

  it('stops delivering after unmount', () => {
    const emit = createSyncEventEmitter(window.electron)
    const handler = vi.fn()
    const { unmount } = renderHook(() => useSyncEvents(handler))

    unmount()
    act(() => {
      emit(completed)
    })

    expect(handler).not.toHaveBeenCalled()
  })
})
