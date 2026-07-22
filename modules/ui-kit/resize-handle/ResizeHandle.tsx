import { type KeyboardEvent, type PointerEvent, type ReactElement, useRef } from 'react'
import { cn } from '../utils'

export interface ResizeHandleProps {
  // Current width and bounds — for the splitter's aria value.
  value: number
  min: number
  max: number
  onResizeStart: () => void
  onResize: (deltaX: number) => void
  onResizeEnd: () => void
  'aria-label': string
  className?: string
  // Pixels moved per arrow key (×3 with Shift).
  step?: number
}

// A draggable window splitter — a 1px divider line that recolors on hover and
// focus. It occupies exactly 1px of layout, like the `border-r` it replaces:
// a wider box would open a visible gutter between the panels (the grab zone is
// an invisible pseudo-element straddling the line instead). Pointer capture
// keeps the drag alive even when the cursor leaves the handle. Neutral tones
// only (copper stays scarce); the active/focus line uses `info`.
// Keyboard-operable: Arrow keys nudge, Shift for a bigger step.
export function ResizeHandle({
  value,
  min,
  max,
  onResizeStart,
  onResize,
  onResizeEnd,
  'aria-label': ariaLabel,
  className,
  step = 16,
}: ResizeHandleProps): ReactElement {
  const startX = useRef(0)

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    startX.current = event.clientX
    event.currentTarget.setPointerCapture(event.pointerId)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    onResizeStart()
  }
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    onResize(event.clientX - startX.current)
  }
  const handlePointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    onResizeEnd()
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const delta = (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? step * 3 : step)
    onResizeStart()
    onResize(delta)
    onResizeEnd()
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: a focusable window splitter needs role="separator" with value semantics; <hr> can't be interactive
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
      className={cn(
        'relative z-10 w-px shrink-0 cursor-col-resize touch-none select-none bg-border outline-none transition-colors',
        'hover:bg-foreground-subtle focus-visible:bg-info active:bg-info',
        // Invisible 9px grab zone straddling the line: comfortable to hit
        // without costing layout width. z-10 keeps it above the neighbouring
        // panels, which sit later in the DOM.
        'after:absolute after:inset-y-0 after:-left-1 after:-right-1 after:content-[""]',
        className,
      )}
    />
  )
}
