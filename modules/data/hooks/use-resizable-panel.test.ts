import { act, renderHook, waitFor } from '@test-utils'
import { PANEL_WIDTHS_STORAGE_KEY } from '../queries/local'
import { useResizablePanel } from './use-resizable-panel'

beforeEach(() => {
  localStorage.clear()
})

describe('useResizablePanel', () => {
  it('tracks the drag, clamps to max, and persists on release', async () => {
    const { result } = renderHook(() =>
      useResizablePanel('jobs', { min: 320, max: 720, grows: 'right' }),
    )
    expect(result.current.width).toBe(420) // default

    act(() => {
      result.current.onResizeStart()
    })
    act(() => {
      result.current.onResize(100)
    })
    expect(result.current.width).toBe(520)

    // Runaway drags clamp to max rather than growing without bound.
    act(() => {
      result.current.onResize(9999)
    })
    expect(result.current.width).toBe(720)

    act(() => {
      result.current.onResizeEnd()
    })
    await waitFor(() => {
      const stored = localStorage.getItem(PANEL_WIDTHS_STORAGE_KEY)
      expect(JSON.parse(stored as string).jobs).toBe(720)
    })
  })

  it('clamps to min and grows leftward for a left-edge handle', () => {
    const { result } = renderHook(() =>
      useResizablePanel('activity', { min: 260, max: 520, grows: 'left' }),
    )
    expect(result.current.width).toBe(320) // default

    act(() => {
      result.current.onResizeStart()
    })
    // Dragging LEFT widens a left-edge panel.
    act(() => {
      result.current.onResize(-60)
    })
    expect(result.current.width).toBe(380)

    act(() => {
      result.current.onResize(9999)
    })
    expect(result.current.width).toBe(260)
  })

  it('does nothing on release when no drag happened', () => {
    const { result } = renderHook(() =>
      useResizablePanel('jobs', { min: 320, max: 720, grows: 'right' }),
    )
    act(() => {
      result.current.onResizeEnd()
    })
    expect(localStorage.getItem(PANEL_WIDTHS_STORAGE_KEY)).toBeNull()
  })
})
