import type { AgentRunSummary, AgentTraceEvent } from '@data'
import { useAgentRunSteps, useAgentRuns } from '@data'
import { cn, formatRelativeTime, ScrollArea } from '@ui-kit'
import { Activity, History, Inbox } from 'lucide-react'
import { type ReactElement, useEffect, useMemo, useState } from 'react'
import { formatTraceDuration } from './format-duration'
import { PipelineFunnel } from './PipelineFunnel'
import { TraceLegend } from './TraceDot'
import { TraceJobs } from './TraceJobs'
import { latestStats, TraceRowList } from './TraceRowList'

// Every job the run ingested, flattened across its verdict steps and deduped by
// id — the run's actual harvest, shown in its own column.
function harvestJobs(events: AgentTraceEvent[]): NonNullable<AgentTraceEvent['jobs']> {
  const byId = new Map<string, NonNullable<AgentTraceEvent['jobs']>[number]>()
  for (const event of events) {
    for (const job of event.jobs ?? []) if (!byId.has(job.id)) byId.set(job.id, job)
  }
  return [...byId.values()]
}

// A run's outcome, coloured like the timeline dots: completed = green,
// failed = red, stopped = grey, running = the info accent.
const STATUS_DOT: Record<AgentRunSummary['status'], string> = {
  completed: 'bg-success',
  failed: 'bg-destructive',
  stopped: 'bg-foreground-ghost',
  running: 'bg-info',
}

function runDurationLabel(run: AgentRunSummary): string {
  if (run.finishedAt === null) return '—'
  const ms = Date.parse(run.finishedAt) - Date.parse(run.startedAt)
  return formatTraceDuration(ms)
}

function RunListItem({
  run,
  selected,
  onSelect,
}: {
  run: AgentRunSummary
  selected: boolean
  onSelect: () => void
}): ReactElement {
  return (
    <button
      type="button"
      data-selected={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full flex-col gap-1 rounded-lg border border-border bg-surface-raised px-3 py-2 text-left',
        'shadow-elevation-low transition-colors hover:bg-interactive-hover',
        selected && 'border-primary bg-primary/10',
      )}
    >
      <span className="flex items-center gap-2">
        <span
          className={cn('size-1.5 shrink-0 rounded-full', STATUS_DOT[run.status])}
          aria-hidden
        />
        <span className={cn('text-sm font-medium', selected && 'text-primary')}>
          {run.status === 'running' ? 'Running…' : run.status}
        </span>
        <span className="ml-auto shrink-0 text-[0.65rem] tabular-nums text-foreground-subtle">
          {runDurationLabel(run)}
        </span>
      </span>
      <span className="label-caps flex w-full items-center gap-1.5 normal-case tracking-[0.02em]">
        <span className="min-w-0 flex-1 truncate">
          {run.jobsKept} job{run.jobsKept === 1 ? '' : 's'} · {run.emailsProcessed}/
          {run.emailsTotal} emails · {run.trigger}
        </span>
        <span className="shrink-0">{formatRelativeTime(run.startedAt)}</span>
      </span>
    </button>
  )
}

// The Runs page: persisted agent-run history (left) and the selected run's full
// timeline (right), rendered with the SAME components as the live Agent panel —
// funnel, dots, expandable prompt/response bodies. A finished run marks no row
// active, so nothing spins. The newest run is selected on first load.
export function RunsPage(): ReactElement {
  const runs = useAgentRuns()
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // Default to the newest run once the list arrives, without clobbering an
  // explicit choice.
  const firstRunId = runs.data?.[0]?.id ?? null
  useEffect(() => {
    if (selectedId === null && firstRunId !== null) setSelectedId(firstRunId)
  }, [selectedId, firstRunId])

  const steps = useAgentRunSteps(selectedId)
  const events = steps.data ?? []
  const funnel = latestStats(events)
  const jobs = useMemo(() => harvestJobs(events), [events])

  return (
    <div className="flex h-full min-h-0">
      {/* Master list — a secondary sidebar (§sidebars): body at `background`,
          header + footer one step up on `surface-hover` + `border-border`. */}
      <div className="flex w-80 shrink-0 flex-col border-r border-border-subtle bg-background">
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface-hover px-3">
          <History className="size-4" />
          <span className="text-sm font-semibold">Run history</span>
          <span className="ml-auto text-[0.65rem] tabular-nums text-foreground-subtle">
            {runs.data?.length ?? 0}
          </span>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-2 p-3">
            {(runs.data ?? []).length === 0 ? (
              <p className="text-xs text-foreground-muted">
                No runs yet. Start the agent from the activity panel — each pass is recorded here.
              </p>
            ) : (
              (runs.data ?? []).map((run) => (
                <RunListItem
                  key={run.id}
                  run={run}
                  selected={run.id === selectedId}
                  onSelect={() => setSelectedId(run.id)}
                />
              ))
            )}
          </div>
        </ScrollArea>
        {/* Footer bookend (§sidebars rule 2) — the retention note. */}
        <footer className="label-caps shrink-0 border-t border-border bg-surface-hover px-3 py-2">
          Keeps the last 50 runs
        </footer>
      </div>

      {/* Detail — two columns so the wide space earns its keep: the run's
          timeline, and the jobs that run actually harvested. */}
      {selectedId === null ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-foreground-muted">
          Select a run to see its timeline.
        </div>
      ) : (
        <>
          {/* Timeline column — a fixed reading width, not a full-bleed banner.
              Header bookend matches the Jobs column (§sidebars). */}
          <div className="flex w-[440px] shrink-0 flex-col border-r border-border-subtle bg-background">
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface-hover px-3">
              <Activity className="size-4" />
              <span className="text-sm font-semibold">Timeline</span>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              {/* Funnel inside the scroll so its sticky glass header floats over
                  the rows as they scroll under it (read-only: 'idle' hides the
                  transport controls). */}
              {funnel !== null ? (
                <PipelineFunnel
                  stats={funnel.stats}
                  state="idle"
                  onStop={() => {}}
                  onPause={() => {}}
                  onResume={() => {}}
                />
              ) : null}
              <div className="p-3">
                {events.length === 0 ? (
                  <p className="text-xs text-foreground-muted">
                    {steps.isLoading ? 'Loading…' : 'This run recorded no steps.'}
                  </p>
                ) : (
                  <>
                    <TraceLegend />
                    <TraceRowList events={events} activeSeq={null} />
                  </>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Jobs column — the run's harvest as feed-style cards. */}
          <div className="flex min-w-0 flex-1 flex-col bg-background">
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface-hover px-3">
              <Inbox className="size-4" />
              <span className="text-sm font-semibold">Jobs found</span>
              <span className="ml-auto text-[0.65rem] tabular-nums text-foreground-subtle">
                {jobs.length}
              </span>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <section className="p-3" aria-label="Jobs found">
                {jobs.length === 0 ? (
                  <p className="text-xs text-foreground-muted">
                    This run kept no jobs — every scanned email was rejected or yielded none.
                  </p>
                ) : (
                  // TraceJobs renders the same compact feed cards used under a
                  // live verdict row.
                  <TraceJobs jobs={jobs} />
                )}
              </section>
            </ScrollArea>
          </div>
        </>
      )}
    </div>
  )
}
