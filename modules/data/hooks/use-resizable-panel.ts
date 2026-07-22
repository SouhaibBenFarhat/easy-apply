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
  // Mirrored in a ref because a keyboard nudge fires start → resize → end in a
  // SINGLE batched update, where the state value would still read null and the
  // nudge would be dropped before it ever reached storage.
  const [dragWidth, setDragWidth] = useState<number | null>(null)
  const dragRef = useRef<number | null>(null)
  const startWidth = useRef(0)

  const width = clamp(dragWidth ?? persisted[panel], min, max)

  const onResizeStart = useCallback(() => {
    startWidth.current = width
  }, [width])

  const onResize = useCallback(
    (deltaX: number) => {
      const signed = grows === 'right' ? deltaX : -deltaX
      const next = clamp(startWidth.current + signed, min, max)
      dragRef.current = next
      setDragWidth(next)
    },
    [grows, min, max],
  )

  const onResizeEnd = useCallback(() => {
    const next = dragRef.current
    if (next === null) return
    dragRef.current = null
    setStored.mutate(
      { ...persisted, [panel]: next },
      {
        // Release the live width only once the persisted value has caught up.
        // Clearing it up front would render a frame at the OLD persisted width
        // while the mutation is still in flight — the snap-back on release.
        // A drag that started in the meantime owns the width, so leave it be.
        onSettled: () => {
          if (dragRef.current === null) setDragWidth(null)
        },
      },
    )
  }, [persisted, panel, setStored])

  return { width, min, max, onResizeStart, onResize, onResizeEnd }
}
