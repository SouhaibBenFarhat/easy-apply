import type { AgentTraceEvent } from '@data'
import { cn } from '@ui-kit'
import type { ReactElement } from 'react'

// Per-email verdict rows, as the mailbox provider labels them:
// "Subject · 2 job(s)" (accepted) and "Subject · no jobs" (rejected).
const ACCEPTED_RE = /·\s*\d+\s*job\(s\)$/
const REJECTED_RE = /·\s*no jobs$/

export type TraceDotTone = 'accepted' | 'rejected' | 'step' | 'model' | 'failed'

export const TRACE_TONES: Record<TraceDotTone, { className: string; label: string }> = {
  // Green matches the funnel's Accepted counter; grey matches Rejected.
  accepted: { className: 'bg-success', label: 'jobs found' },
  rejected: { className: 'bg-foreground-ghost', label: 'no jobs' },
  step: { className: 'bg-info', label: 'step' },
  model: { className: 'bg-warning', label: 'model' },
  failed: { className: 'bg-destructive', label: 'failed' },
}

// The dot's colour is the verdict at a glance: which emails yielded jobs and
// which were dismissed, without reading a single label.
export function traceTone(event: AgentTraceEvent): TraceDotTone {
  if (/fail|skipped/i.test(event.label)) return 'failed'
  if (event.channel === 'pipeline') {
    if (ACCEPTED_RE.test(event.label)) return 'accepted'
    if (REJECTED_RE.test(event.label)) return 'rejected'
    return 'step'
  }
  if (event.channel === 'llm' || event.channel === 'thinking') return 'model'
  return 'step'
}

export interface TraceDotProps {
  event: AgentTraceEvent
  /** The checkpoint being worked on right now — draws a spinner around it. */
  active?: boolean
  className?: string
}

export function TraceDot({ event, active = false, className }: TraceDotProps): ReactElement {
  const tone = TRACE_TONES[traceTone(event)]
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
          className="absolute -inset-1 animate-spin-slow rounded-full border border-info border-t-transparent"
        />
      ) : null}
      <span className={cn('size-2 rounded-full', tone.className)} />
    </span>
  )
}

// Without this the dots are just unexplained colours.
export function TraceLegend(): ReactElement {
  return (
    <ul className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6rem] text-foreground-subtle">
      {Object.entries(TRACE_TONES).map(([key, tone]) => (
        <li key={key} className="flex items-center gap-1">
          <span className={cn('size-1.5 rounded-full', tone.className)} aria-hidden />
          {tone.label}
        </li>
      ))}
    </ul>
  )
}
