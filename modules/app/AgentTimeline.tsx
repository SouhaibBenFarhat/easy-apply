import type { AgentTraceEvent } from '@data'
import { useAgentTrace } from '@data'
import { Button, cn, ScrollArea } from '@ui-kit'
import { Activity, X } from 'lucide-react'
import type { ReactElement } from 'react'

function dotColor(event: AgentTraceEvent): string {
  if (/fail|skipped/i.test(event.label)) return 'bg-destructive'
  if (event.channel === 'llm') return 'bg-warning'
  if (event.channel === 'mailbox') return 'bg-info'
  return 'bg-foreground-muted'
}

function TimelineRow({ event, last }: { event: AgentTraceEvent; last: boolean }): ReactElement {
  const time = event.at.slice(11, 19) // HH:MM:SS
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
      <span className="min-w-0 flex-1 truncate text-xs" title={event.label}>
        {event.label}
      </span>
    </li>
  )
}

export interface AgentTimelineProps {
  onClose: () => void
}

// Layout-push activity panel (not an overlay): a compact vertical timeline of
// the agent's checkpoints — sync steps, inbox reads, and each LLM call with its
// prompt/response — each with a status dot. Its header uses the chrome tone +
// full-strength borders (§visual-hierarchy).
export function AgentTimeline({ onClose }: AgentTimelineProps): ReactElement {
  const trace = useAgentTrace()
  const events = trace.data ?? []

  return (
    // Secondary sidebar (§sidebars): body `background`; header + footer one step
    // up on `surface` — a rung BELOW the main nav so they never merge.
    <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-background">
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
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-3">
          {events.length === 0 ? (
            <p className="text-xs text-foreground-muted">
              Nothing yet. Hit “Sync now” — each checkpoint (inbox reads, every LLM prompt/response)
              lands here.
            </p>
          ) : (
            <ol>
              {events.map((event, index) => (
                <TimelineRow key={event.seq} event={event} last={index === events.length - 1} />
              ))}
            </ol>
          )}
        </div>
      </ScrollArea>
      <footer className="label-caps shrink-0 border-t border-border bg-surface-hover px-3 py-2">
        {events.length === 0
          ? 'Idle'
          : `${events.length} checkpoint${events.length === 1 ? '' : 's'}`}
      </footer>
    </aside>
  )
}
