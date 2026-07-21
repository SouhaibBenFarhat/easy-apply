import { useCallback, useRef, useState } from 'react'
import { useSetStoredPanelWidths } from '../mutations/local'
import { DEFAULT_PANEL_WIDTHS, type PanelWidths, useStoredPanelWidths } from '../queries/local'

// What a resizable panel exposes: its live width and the drag callbacks a
// ResizeHandle drives. The width is persisted (localStorage) and clamped to
// [min, max]; committing happens on drag end so we don't thrash storage.
export interface ResizablePanel {
  width: number
  min: number
  max: number
  onResizeStart: () => void
  onResize: (deltaX: number) => void
  onResizeEnd: () => void
}

export interface ResizablePanelOptions {
  min: number
  max: number
  // Which drag direction grows the panel: a right-edge handle grows on
  // rightward drag; a left-edge handle grows on leftward drag.
  grows: 'left' | 'right'
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function useResizablePanel(
  panel: keyof PanelWidths,
  { min, max, grows }: ResizablePanelOptions,
): ResizablePanel {
  const stored = useStoredPanelWidths()
  const setStored = useSetStoredPanelWidths()
  const persisted = stored.data ?? DEFAULT_PANEL_WIDTHS
  // Live width during a drag; null when not dragging (fall back to persisted).
  const [drag, setDrag] = useState<number | null>(null)
  const startWidth = useRef(0)

  const width = clamp(drag ?? persisted[panel], min, max)

  const onResizeStart = useCallback(() => {
    startWidth.current = width
  }, [width])

  const onResize = useCallback(
    (deltaX: number) => {
      const signed = grows === 'right' ? deltaX : -deltaX
      setDrag(clamp(startWidth.current + signed, min, max))
    },
    [grows, min, max],
  )

  const onResizeEnd = useCallback(() => {
    if (drag === null) return
    setStored.mutate({ ...persisted, [panel]: drag })
    setDrag(null)
  }, [drag, persisted, panel, setStored])

  return { width, min, max, onResizeStart, onResize, onResizeEnd }
}
