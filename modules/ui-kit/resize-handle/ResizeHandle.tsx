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

// A draggable window splitter — a thin divider whose 1px line thickens on hover
// and focus. Pointer capture keeps the drag alive even when the cursor leaves
// the handle. Neutral tones only (copper stays scarce); the active/focus line
// uses `info`. Keyboard-operable: Arrow keys nudge, Shift for a bigger step.
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
        'group relative flex w-1.5 shrink-0 cursor-col-resize touch-none select-none items-stretch justify-center outline-none',
        className,
      )}
    >
      <span
        className="w-px bg-border transition-colors group-hover:bg-foreground-subtle group-focus-visible:bg-info group-active:bg-info"
        aria-hidden
      />
    </div>
  )
}
