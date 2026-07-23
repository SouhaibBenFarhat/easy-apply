import type { AgentPipelineStats, AgentTraceEvent } from '@data'
import { useAgentState, useAgentTrace, usePauseAgent, useResumeAgent, useStopAgent } from '@data'
import { Button, cn, ScrollArea } from '@ui-kit'
import { Activity, Brain, ChevronRight, Play, X } from 'lucide-react'
import { type ReactElement, useState } from 'react'
import { formatElapsedClock, formatTraceDuration } from './format-duration'
import { useElapsedSince } from './hooks/use-elapsed-since'
import { PipelineFunnel } from './PipelineFunnel'
import { TraceDot, TraceLegend } from './TraceDot'
import { TraceJobs } from './TraceJobs'

// The most recent funnel snapshot, if any 'pipeline' event has arrived — with
// the event's timestamp, which is the current step's start (during the slow
// LLM call the newest stats event is the email's own 'Analyzing' row).
function latestStats(events: AgentTraceEvent[]): { stats: AgentPipelineStats; at: string } | null {
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

export interface AgentTimelineProps {
  onClose: () => void
  /**
   * Begins a run. Comes from the shared sync controls rather than a local
   * mutation, so a run started here reports its summary the same way as
   * anywhere else.
   */
  onStart: () => void
  // Resizable width in px (the left-edge handle lives in RootLayout, which owns
  // the divider — so this panel carries no left border).
  width?: number
}

// Layout-push activity panel (not an overlay): a compact vertical timeline of
// the agent's checkpoints — sync steps, inbox reads, and each LLM call with its
// prompt/response — each with a status dot. Its header uses the chrome tone +
// full-strength borders (§visual-hierarchy).
export function AgentTimeline({ onClose, onStart, width = 320 }: AgentTimelineProps): ReactElement {
  const trace = useAgentTrace()
  const stop = useStopAgent()
  const pause = usePauseAgent()
  const resume = useResumeAgent()
  const state = useAgentState().data ?? 'idle'
  const events = trace.data ?? []
  const funnel = latestStats(events)

  return (
    // Secondary sidebar (§sidebars): body `background`; header + footer one step
    // up on `surface` — a rung BELOW the main nav so they never merge.
    <aside style={{ width }} className="flex shrink-0 flex-col bg-background">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface-hover px-3">
        <Activity className="size-4" />
        <span className="text-sm font-semibold">Agent activity</span>
        {/* The one place a run begins — the agent's own panel. Hidden outright
            while a run is active, where the transport below owns the controls,
            so there is never a second way to kick a run off. */}
        {state === 'idle' ? (
          <Button size="sm" className="ml-auto h-6 gap-1 px-2 text-xs" onClick={onStart}>
            <Play className="size-3" /> Start
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close activity"
          className={cn(state === 'idle' ? 'ml-1' : 'ml-auto')}
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      {funnel !== null ? (
        <PipelineFunnel
          stats={funnel.stats}
          stepStartedAt={funnel.at}
          state={state}
          onStop={() => stop.mutate()}
          onPause={() => pause.mutate()}
          onResume={() => resume.mutate()}
        />
      ) : null}
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-3">
          {events.length === 0 ? (
            <p className="text-xs text-foreground-muted">
              Nothing yet. Hit Start above — each scanned email lands here; click a prompt or
              response row to read exactly what the model saw and returned.
            </p>
          ) : (
            <>
              <TraceLegend />
              <ol>
                {events.map((event, index) => {
                  const last = index === events.length - 1
                  // The newest checkpoint is what the agent is working on, but
                  // only while it genuinely is: a held run spins nothing, and a
                  // pause still winding down does.
                  const active = last && (state === 'running' || state === 'pausing')
                  // Rows with a body (prompt/response/reasoning) are expandable so
                  // you can read what each scanned email produced.
                  const hasBody = typeof event.body === 'string' && event.body.trim() !== ''
                  return hasBody ? (
                    <ExpandableRow key={event.seq} event={event} last={last} active={active} />
                  ) : (
                    <TimelineRow key={event.seq} event={event} last={last} active={active} />
                  )
                })}
              </ol>
            </>
          )}
        </div>
      </ScrollArea>
      <footer className="label-caps shrink-0 border-t border-border bg-surface-hover px-3 py-2">
        {funnel !== null
          ? `${funnel.stats.jobsKept} job${funnel.stats.jobsKept === 1 ? '' : 's'} · ${funnel.stats.emailsProcessed}/${funnel.stats.emailsTotal} emails`
          : events.length === 0
            ? 'Idle'
            : `${events.length} checkpoint${events.length === 1 ? '' : 's'}`}
      </footer>
    </aside>
  )
}
