import type { AgentTraceEvent } from '@data'
import { cn } from '@ui-kit'
import type { ReactElement } from 'react'

// Per-email verdict rows, as the mailbox provider labels them:
// "Subject · 2 job(s)" (accepted) and "Subject · no jobs" (rejected).
const ACCEPTED_RE = /·\s*\d+\s*job\(s\)$/
const REJECTED_RE = /·\s*no jobs$/

export type TraceDotTone = 'accepted' | 'rejected' | 'step' | 'model' | 'failed'

export const TRACE_TONES: Record<
  TraceDotTone,
  { className: string; border: string; label: string }
> = {
  // Green matches the funnel's Accepted counter; grey matches Rejected.
  accepted: { className: 'bg-success', border: 'border-success', label: 'jobs found' },
  rejected: {
    className: 'bg-foreground-ghost',
    border: 'border-foreground-ghost',
    label: 'no jobs',
  },
  step: { className: 'bg-info', border: 'border-info', label: 'step' },
  model: { className: 'bg-warning', border: 'border-warning', label: 'model' },
  failed: { className: 'bg-destructive', border: 'border-destructive', label: 'failed' },
}

// Colour says WHAT the row is; fill says WHETHER it finished.
//
// A row either opens a step ("Analyzing …", "Prompt", "Connecting …") or closes
// one ("… · 2 job(s)", "Response", "Found 313 email(s)"). Only closing rows
// carry `durationMs` — main stamps it when the work actually completed. Painting
// both alike is what let a crashed run pass for a finished one: the opening row
// sat there in exactly the same blue as a completed step, forever.
export function isCompletedStep(event: AgentTraceEvent): boolean {
  // Reasoning is the one exception: it is emitted after the generation is over,
  // but its time is reported on the Response row that follows it.
  return event.durationMs !== undefined || event.channel === 'thinking'
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
  // Solid = the step finished. Hollow = it opened and hasn't closed: spinning
  // if it is the one in flight, and — tellingly — still hollow if the run died
  // without ever closing it.
  const completed = isCompletedStep(event)
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
      <span
        className={cn(
          'size-2 rounded-full',
          completed ? tone.className : cn('border-2 bg-transparent', tone.border),
        )}
      />
    </span>
  )
}

// Without this the dots are just unexplained colours — and the hollow/solid
// distinction is worth a word of its own, since it is the one that says whether
// a step actually finished.
export function TraceLegend(): ReactElement {
  return (
    <ul className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6rem] text-foreground-subtle">
      <li className="flex items-center gap-1">
        <span className="size-2 rounded-full border-2 border-info bg-transparent" aria-hidden />
        in progress
      </li>
      {Object.entries(TRACE_TONES).map(([key, tone]) => (
        <li key={key} className="flex items-center gap-1">
          <span className={cn('size-2 rounded-full', tone.className)} aria-hidden />
          {tone.label}
        </li>
      ))}
    </ul>
  )
}
