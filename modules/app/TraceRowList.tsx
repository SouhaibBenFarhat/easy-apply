import type { AgentPipelineStats, AgentTraceEvent } from '@data'
import { cn } from '@ui-kit'
import { Brain, ChevronRight } from 'lucide-react'
import { type ReactElement, useState } from 'react'
import { formatElapsedClock, formatTraceDuration } from './format-duration'
import { useElapsedSince } from './hooks/use-elapsed-since'
import { TraceDot } from './TraceDot'
import { TraceJobs } from './TraceJobs'

// The timeline row rendering, shared by the live Agent panel and the Runs page
// (a past run renders identically to a live one — same rows, same dots, same
// expandable prompt/response bodies). The only difference is `activeSeq`: the
// live panel marks its newest row active (spinner); a finished run marks none.

// The most recent funnel snapshot, if any 'pipeline' event has arrived — with
// the event's timestamp, which is the current step's start (during the slow
// LLM call the newest stats event is the email's own 'Analyzing' row).
export function latestStats(
  events: AgentTraceEvent[],
): { stats: AgentPipelineStats; at: string } | null {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i]
    if (event?.stats !== undefined) return { stats: event.stats, at: event.at }
  }
  return null
}

// The timing slot at the right edge of a row, safe from label truncation.
// A completed step shows its main-stamped duration ("12s"); the in-flight step
// shows a live stopwatch since its main-stamped start ("0:42"), ticking every
// second — distinct shapes, so a running count never reads as a final figure.
// The counter stops with `active`: a held (paused) run counts nothing.
function TraceTimer({
  event,
  active,
}: {
  event: AgentTraceEvent
  active: boolean
}): ReactElement | null {
  const runningMs = useElapsedSince(event.at, active && event.durationMs === undefined)
  const text =
    event.durationMs !== undefined
      ? formatTraceDuration(event.durationMs)
      : runningMs === null
        ? ''
        : formatElapsedClock(runningMs)
  if (text === '') return null
  return <span className="shrink-0 text-[0.65rem] tabular-nums text-foreground-subtle">{text}</span>
}

function TimelineRow({
  event,
  last,
  active,
}: {
  event: AgentTraceEvent
  last: boolean
  active: boolean
}): ReactElement {
  const time = event.at.slice(11, 19) // HH:MM:SS
  // Per-email pipeline rows carry the scanned email's Gmail link — make the
  // label clickable so you can open the email straight from the history.
  const url = event.stats?.current?.url ?? null
  // The verdict is the whole point of a per-email row, but it lives at the END
  // of the label — where a long subject truncated it away, leaving no way to
  // tell an accepted email from a rejected one. Pin it so it never truncates.
  const verdict =
    event.jobs === undefined
      ? null
      : event.jobs.length > 0
        ? `${event.jobs.length} job(s)`
        : 'no jobs'
  const subject =
    verdict === null ? event.label : event.label.replace(/\s*·\s*(?:\d+ job\(s\)|no jobs)$/, '')
  // Pipeline steps are the noisy per-email rows — dim them a touch so the
  // sync/mailbox/llm checkpoints stay more prominent.
  const labelClass = cn(
    'min-w-0 flex-1 truncate text-xs',
    event.channel === 'pipeline' && 'text-foreground-muted',
  )
  return (
    <li className="relative flex items-start gap-2.5 pb-3">
      {/* Connector to the next checkpoint (not on the last). */}
      {!last ? (
        <span className="absolute bottom-0 left-[3.5px] top-3 w-px bg-border-muted" aria-hidden />
      ) : null}
      <TraceDot event={event} active={active} className="mt-1" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2.5">
          <span className="shrink-0 text-[0.65rem] tabular-nums text-foreground-subtle">
            {time}
          </span>
          {url !== null ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className={cn(labelClass, 'transition-colors hover:text-primary')}
              title={`Open in Gmail: ${event.label}`}
            >
              {subject}
            </a>
          ) : (
            <span className={labelClass} title={event.label}>
              {subject}
            </span>
          )}
          {verdict !== null ? (
            <span
              className={cn(
                'shrink-0 text-[0.65rem] font-medium',
                event.jobs !== undefined && event.jobs.length > 0
                  ? 'text-success'
                  : 'text-foreground-ghost',
              )}
            >
              {verdict}
            </span>
          ) : null}
          <TraceTimer event={event} active={active} />
        </div>
        {/* What this email actually produced — the agent's work, auditable. */}
        {event.jobs !== undefined ? <TraceJobs jobs={event.jobs} /> : null}
      </div>
    </li>
  )
}

// Any event carrying a body — a reasoning block, or an LLM prompt/response —
// is collapsed by default; click the header to read the full text. This is how
// you inspect a scanned email: expand its Response to see exactly what the model
// proposed and why the harness kept (or dropped) it.
function ExpandableRow({
  event,
  last,
  active,
}: {
  event: AgentTraceEvent
  last: boolean
  active: boolean
}): ReactElement {
  const [open, setOpen] = useState(false)
  const time = event.at.slice(11, 19)
  const isThinking = event.channel === 'thinking'
  return (
    <li className="relative flex items-start gap-2.5 pb-3">
      {!last ? (
        <span className="absolute bottom-0 left-[3.5px] top-3 w-px bg-border-muted" aria-hidden />
      ) : null}
      <TraceDot event={event} active={active} className="mt-1" />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center gap-1.5 text-left text-xs font-medium text-foreground-muted transition-colors hover:text-foreground"
        >
          <span className="shrink-0 text-[0.65rem] tabular-nums text-foreground-subtle">
            {time}
          </span>
          {isThinking ? <Brain className="size-3 shrink-0" /> : null}
          <span className="min-w-0 flex-1 truncate">{event.label}</span>
          <TraceTimer event={event} active={active} />
          <ChevronRight
            className={cn('size-3 shrink-0 transition-transform', open && 'rotate-90')}
          />
        </button>
        {/* Recessed well one step below the panel body (§visual-hierarchy):
            `input` (0.128) < `background` (0.145) + border-border. */}
        {open ? (
          <div
            className={cn(
              'mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-input p-2 text-[0.7rem] leading-relaxed text-foreground-muted',
              isThinking && 'italic',
            )}
          >
            {event.body}
          </div>
        ) : null}
      </div>
    </li>
  )
}

export interface TraceRowListProps {
  events: AgentTraceEvent[]
  // The seq of the row that is genuinely in flight (spinner + live counter), or
  // null — which is always the case for a finished, historical run.
  activeSeq?: number | null
}

// The <ol> of timeline rows. Rows with a body are expandable; the newest
// in-flight row spins.
export function TraceRowList({ events, activeSeq = null }: TraceRowListProps): ReactElement {
  return (
    <ol>
      {events.map((event, index) => {
        const last = index === events.length - 1
        const active = event.seq === activeSeq
        // Rows with a body (prompt/response/reasoning) are expandable so you
        // can read what each scanned email produced.
        const hasBody = typeof event.body === 'string' && event.body.trim() !== ''
        return hasBody ? (
          <ExpandableRow key={event.seq} event={event} last={last} active={active} />
        ) : (
          <TimelineRow key={event.seq} event={event} last={last} active={active} />
        )
      })}
    </ol>
  )
}
