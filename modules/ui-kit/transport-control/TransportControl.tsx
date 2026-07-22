import { Pause, Play, Square } from 'lucide-react'
import type { ReactElement } from 'react'
import { Button } from '../button'
import { cn } from '../utils'

// Pause · resume · stop for a long-running job. Starting one is deliberately
// NOT here: a run has exactly one launch point, so this control never doubles
// as a second way to kick things off.
//
// `pausing` is the state that makes this honest. When a pause can only take
// effect at the next checkpoint, the control must acknowledge the click
// immediately and say it is still winding down — otherwise the button looks
// dead and the user clicks again. Presentational only: the caller owns the
// state and the handlers.
export type TransportState = 'idle' | 'running' | 'pausing' | 'paused'

export interface TransportControlProps {
  state: TransportState
  onPause: () => void
  onResume: () => void
  onStop: () => void
  /** Icon-only, for tight chrome like the app header. */
  compact?: boolean
  className?: string
}

interface PrimaryAction {
  icon: ReactElement
  label: string
  disabled: boolean
}

function primaryAction(state: Exclude<TransportState, 'idle'>): PrimaryAction {
  switch (state) {
    case 'running':
      return { icon: <Pause />, label: 'Pause', disabled: false }
    // Held at the next checkpoint, not yet there — acknowledged but not
    // actionable, so the button reads as pending rather than inert.
    case 'pausing':
      return { icon: <Pause />, label: 'Pausing…', disabled: true }
    case 'paused':
      return { icon: <Play />, label: 'Resume', disabled: false }
  }
}

export function TransportControl({
  state,
  onPause,
  onResume,
  onStop,
  compact = false,
  className,
}: TransportControlProps): ReactElement | null {
  // Nothing to transport when nothing is running.
  if (state === 'idle') return null

  const primary = primaryAction(state)
  const onPrimary = (): void => {
    if (state === 'paused') onResume()
    else if (state === 'running') onPause()
  }

  return (
    <div
      className={cn('flex items-center gap-1', className)}
      role="toolbar"
      aria-label="Agent transport"
    >
      <Button
        size="icon-sm"
        variant={compact ? 'ghost' : 'secondary'}
        aria-label={primary.label}
        title={primary.label}
        disabled={primary.disabled}
        onClick={onPrimary}
      >
        {primary.icon}
      </Button>
      {compact ? (
        <Button size="icon-sm" variant="ghost" aria-label="Stop" title="Stop" onClick={onStop}>
          <Square />
        </Button>
      ) : (
        <Button size="sm" variant="secondary" className="h-6 gap-1 px-2 text-xs" onClick={onStop}>
          <Square className="size-3" /> Stop
        </Button>
      )}
    </div>
  )
}
