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

  // Regression: releasing used to clear the live width immediately, so the
  // panel rendered at the OLD persisted width until the (async) mutation
  // landed — a visible snap back and forth on every release.
  it('holds the new width across the release without snapping back', async () => {
    const { result } = renderHook(() =>
      useResizablePanel('jobs', { min: 320, max: 720, grows: 'right' }),
    )

    act(() => {
      result.current.onResizeStart()
      result.current.onResize(80)
    })
    act(() => {
      result.current.onResizeEnd()
    })
    // No intermediate frame at 420: the width is 500 from release onwards.
    expect(result.current.width).toBe(500)
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(PANEL_WIDTHS_STORAGE_KEY) as string).jobs).toBe(500)
    })
    expect(result.current.width).toBe(500)
  })

  // Regression: the ResizeHandle's arrow keys fire start → resize → end in one
  // batched update. Reading the drag from state saw a stale null there, so the
  // nudge never reached storage and was lost on reload.
  it('persists a keyboard nudge fired in a single batched update', async () => {
    const { result } = renderHook(() =>
      useResizablePanel('jobs', { min: 320, max: 720, grows: 'right' }),
    )

    act(() => {
      result.current.onResizeStart()
      result.current.onResize(16)
      result.current.onResizeEnd()
    })

    expect(result.current.width).toBe(436)
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(PANEL_WIDTHS_STORAGE_KEY) as string).jobs).toBe(436)
    })
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
