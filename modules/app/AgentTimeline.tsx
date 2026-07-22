import type { AgentPipelineStats, AgentTraceEvent } from '@data'
import { useAgentTrace, usePauseAgent, useResumeAgent, useStopAgent } from '@data'
import { Button, cn, ScrollArea } from '@ui-kit'
import { Activity, Brain, ChevronRight, X } from 'lucide-react'
import { type ReactElement, useState } from 'react'
import { PipelineFunnel } from './PipelineFunnel'

function dotColor(event: AgentTraceEvent): string {
  if (/fail|skipped/i.test(event.label)) return 'bg-destructive'
  if (event.channel === 'pipeline')
    return /no jobs/.test(event.label) ? 'bg-foreground-ghost' : 'bg-info'
  if (event.channel === 'llm') return 'bg-warning'
  if (event.channel === 'mailbox') return 'bg-info'
  return 'bg-foreground-muted'
}

// The most recent funnel snapshot, if any 'pipeline' event has arrived.
function latestStats(events: AgentTraceEvent[]): AgentPipelineStats | null {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const stats = events[i]?.stats
    if (stats !== undefined) return stats
  }
  return null
}

function TimelineRow({ event, last }: { event: AgentTraceEvent; last: boolean }): ReactElement {
  const time = event.at.slice(11, 19) // HH:MM:SS
  // Per-email pipeline rows carry the scanned email's Gmail link — make the
  // label clickable so you can open the email straight from the history.
  const url = event.stats?.current?.url ?? null
  // Pipeline steps are the noisy per-email rows — dim them a touch so the
  // sync/mailbox/llm checkpoints stay more prominent.
  const labelClass = cn(
    'min-w-0 flex-1 truncate text-xs',
    event.channel === 'pipeline' && 'text-foreground-muted',
  )
  return (
    <li className="relative flex items-baseline gap-2.5 pb-3">
      {/* Connector to the next checkpoint (not on the last). */}
      {!last ? (
        <span className="absolute bottom-0 left-[3.5px] top-3 w-px bg-border-muted" aria-hidden />
      ) : null}
      <span
        className={cn('size-2 shrink-0 self-center rounded-full', dotColor(event))}
        aria-hidden
      />
      <span className="shrink-0 text-[0.65rem] tabular-nums text-foreground-subtle">{time}</span>
      {url !== null ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className={cn(labelClass, 'transition-colors hover:text-primary')}
          title={`Open in Gmail: ${event.label}`}
        >
          {event.label}
        </a>
      ) : (
        <span className={labelClass} title={event.label}>
          {event.label}
        </span>
      )}
    </li>
  )
}

// Any event carrying a body — a reasoning block, or an LLM prompt/response —
// is collapsed by default; click the header to read the full text. This is how
// you inspect a scanned email: expand its Response to see exactly what the model
// proposed and why the harness kept (or dropped) it.
function ExpandableRow({ event, last }: { event: AgentTraceEvent; last: boolean }): ReactElement {
  const [open, setOpen] = useState(false)
  const time = event.at.slice(11, 19)
  const isThinking = event.channel === 'thinking'
  return (
    <li className="relative flex items-start gap-2.5 pb-3">
      {!last ? (
        <span className="absolute bottom-0 left-[3.5px] top-3 w-px bg-border-muted" aria-hidden />
      ) : null}
      <span className={cn('mt-1 size-2 shrink-0 rounded-full', dotColor(event))} aria-hidden />
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
  // Resizable width in px (the left-edge handle lives in RootLayout, which owns
  // the divider — so this panel carries no left border).
  width?: number
}

// Layout-push activity panel (not an overlay): a compact vertical timeline of
// the agent's checkpoints — sync steps, inbox reads, and each LLM call with its
// prompt/response — each with a status dot. Its header uses the chrome tone +
// full-strength borders (§visual-hierarchy).
export function AgentTimeline({ onClose, width = 320 }: AgentTimelineProps): ReactElement {
  const trace = useAgentTrace()
  const stop = useStopAgent()
  const pause = usePauseAgent()
  const resume = useResumeAgent()
  const events = trace.data ?? []
  const stats = latestStats(events)

  return (
    // Secondary sidebar (§sidebars): body `background`; header + footer one step
    // up on `surface` — a rung BELOW the main nav so they never merge.
    <aside style={{ width }} className="flex shrink-0 flex-col bg-background">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface-hover px-3">
        <Activity className="size-4" />
        <span className="text-sm font-semibold">Agent activity</span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close activity"
          className="ml-auto"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      {stats !== null ? (
        <PipelineFunnel
          stats={stats}
          onStop={() => stop.mutate()}
          onPause={() => pause.mutate()}
          onResume={() => resume.mutate()}
        />
      ) : null}
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-3">
          {events.length === 0 ? (
            <p className="text-xs text-foreground-muted">
              Nothing yet. Hit “Sync now” — each scanned email lands here; click a prompt or
              response row to read exactly what the model saw and returned.
            </p>
          ) : (
            <ol>
              {events.map((event, index) => {
                const last = index === events.length - 1
                // Rows with a body (prompt/response/reasoning) are expandable so
                // you can read what each scanned email produced.
                const hasBody = typeof event.body === 'string' && event.body.trim() !== ''
                return hasBody ? (
                  <ExpandableRow key={event.seq} event={event} last={last} />
                ) : (
                  <TimelineRow key={event.seq} event={event} last={last} />
                )
              })}
            </ol>
          )}
        </div>
      </ScrollArea>
      <footer className="label-caps shrink-0 border-t border-border bg-surface-hover px-3 py-2">
        {stats !== null
          ? `${stats.jobsKept} job${stats.jobsKept === 1 ? '' : 's'} · ${stats.emailsProcessed}/${stats.emailsTotal} emails`
          : events.length === 0
            ? 'Idle'
            : `${events.length} checkpoint${events.length === 1 ? '' : 's'}`}
      </footer>
    </aside>
  )
}
