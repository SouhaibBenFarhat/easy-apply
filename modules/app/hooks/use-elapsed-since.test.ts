import { act, renderHook } from '@test-utils'
import { useElapsedSince } from './use-elapsed-since'

describe('useElapsedSince', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-21T09:00:10.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns elapsed ms and ticks once a second while enabled', () => {
    const { result } = renderHook(() => useElapsedSince('2026-07-21T09:00:07.000Z', true))
    expect(result.current).toBe(3_000)
    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    expect(result.current).toBe(5_000)
  })

  it('returns null while disabled and reads fresh once enabled', () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useElapsedSince('2026-07-21T09:00:07.000Z', enabled),
      { initialProps: { enabled: false } },
    )
    expect(result.current).toBeNull()
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(result.current).toBeNull()
    rerender({ enabled: true })
    expect(result.current).toBe(13_000)
  })

  it('clamps a future start to zero and yields null for a garbage timestamp', () => {
    const future = renderHook(() => useElapsedSince('2026-07-21T09:00:59.000Z', true))
    expect(future.result.current).toBe(0)
    const garbage = renderHook(() => useElapsedSince('not-a-date', true))
    expect(garbage.result.current).toBeNull()
  })
})
