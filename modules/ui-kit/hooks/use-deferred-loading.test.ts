import { act, renderHook } from '@test-utils'
import { useDeferredLoading } from './use-deferred-loading'

describe('useDeferredLoading', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns content immediately when not loading', () => {
    const { result } = renderHook(() => useDeferredLoading(false))
    expect(result.current).toBe('content')
  })

  it('never shows a skeleton for loads faster than showDelay', () => {
    const { result, rerender } = renderHook(({ isLoading }) => useDeferredLoading(isLoading), {
      initialProps: { isLoading: true },
    })
    expect(result.current).toBe('blank')
    act(() => {
      vi.advanceTimersByTime(100)
    })
    rerender({ isLoading: false })
    expect(result.current).toBe('content')
    act(() => {
      vi.runAllTimers()
    })
    expect(result.current).toBe('content')
  })

  it('shows the skeleton once showDelay elapses while still loading', () => {
    const { result } = renderHook(() => useDeferredLoading(true))
    act(() => {
      vi.advanceTimersByTime(149)
    })
    expect(result.current).toBe('blank')
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe('skeleton')
  })

  it('keeps the skeleton visible for minVisible after loading finishes', () => {
    const { result, rerender } = renderHook(({ isLoading }) => useDeferredLoading(isLoading), {
      initialProps: { isLoading: true },
    })
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(result.current).toBe('skeleton')
    rerender({ isLoading: false })
    expect(result.current).toBe('skeleton')
    act(() => {
      vi.advanceTimersByTime(399)
    })
    expect(result.current).toBe('skeleton')
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe('content')
  })

  it('respects custom showDelay and minVisible options', () => {
    const { result, rerender } = renderHook(
      ({ isLoading }) => useDeferredLoading(isLoading, { showDelay: 50, minVisible: 100 }),
      { initialProps: { isLoading: true } },
    )
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(result.current).toBe('skeleton')
    rerender({ isLoading: false })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe('content')
  })

  it('clears pending timers on unmount', () => {
    const { unmount } = renderHook(() => useDeferredLoading(true))
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
