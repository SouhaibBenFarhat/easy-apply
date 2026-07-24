import type { AgentTraceEvent } from '@data'
import { cn } from '@ui-kit'
import type { ReactElement } from 'react'

// The dot has exactly four states, and each is STATED, never guessed:
//   done         → green   (the step finished)
//   failed       → red     (the step errored — stated by the emitter)
//   skipped      → grey    (the step was skipped — stated by the emitter)
//   in-progress  → yellow + spinner (the newest row while the agent runs)
//
// `status` rides on the event (default 'done'); 'in-progress' is decided at
// render time because a step is two rows in an append-only log — an opener and
// its result — and only the latest opener is actually running.

export type TraceDotState = 'done' | 'failed' | 'skipped' | 'in-progress'

export const TRACE_DOT_STATES: Record<TraceDotState, { className: string; label: string }> = {
  done: { className: 'bg-success', label: 'done' },
  failed: { className: 'bg-destructive', label: 'failed' },
  skipped: { className: 'bg-foreground-ghost', label: 'skipped' },
  'in-progress': { className: 'bg-warning', label: 'in progress' },
}

// The dot's state: the newest row of a running pass is in-progress; otherwise
// the event's own stated outcome (defaulting to done).
export function traceDotState(event: AgentTraceEvent, active: boolean): TraceDotState {
  if (active) return 'in-progress'
  return event.status ?? 'done'
}

export interface TraceDotProps {
  event: AgentTraceEvent
  /** The checkpoint being worked on right now — the in-progress state. */
  active?: boolean
  className?: string
}

export function TraceDot({ event, active = false, className }: TraceDotProps): ReactElement {
  const state = traceDotState(event, active)
  return (
    <span
      className={cn('relative flex size-2 shrink-0 items-center justify-center', className)}
      aria-hidden={active ? undefined : true}
    >
      {/* The spinner is the only place the panel claims work is in flight, so
          it carries a real accessible name rather than being hidden outright. */}
      {active ? (
        <span
          role="status"
          aria-label="Running"
          className="absolute -inset-1 animate-spin-slow rounded-full border border-warning border-t-transparent"
        />
      ) : null}
      <span className={cn('size-2 rounded-full', TRACE_DOT_STATES[state].className)} />
    </span>
  )
}

// Without this the dots are just unexplained colours.
export function TraceLegend(): ReactElement {
  return (
    <ul className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6rem] text-foreground-subtle">
      {(['in-progress', 'done', 'failed', 'skipped'] as const).map((state) => (
        <li key={state} className="flex items-center gap-1">
          <span
            className={cn('size-2 rounded-full', TRACE_DOT_STATES[state].className)}
            aria-hidden
          />
          {TRACE_DOT_STATES[state].label}
        </li>
      ))}
    </ul>
  )
}
