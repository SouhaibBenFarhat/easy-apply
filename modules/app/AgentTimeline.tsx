import { useAgentState, useAgentTrace, usePauseAgent, useResumeAgent, useStopAgent } from '@data'
import { Button, cn, ScrollArea } from '@ui-kit'
import { Activity, Play, X } from 'lucide-react'
import type { ReactElement } from 'react'
import { PipelineFunnel } from './PipelineFunnel'
import { TraceLegend } from './TraceDot'
import { latestStats, TraceRowList } from './TraceRowList'

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
      <ScrollArea className="min-h-0 flex-1">
        {/* Inside the scroll region so its sticky glass header floats over the
            timeline rows as they scroll under it. */}
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
        <div className="p-3">
          {events.length === 0 ? (
            <p className="text-xs text-foreground-muted">
              Nothing yet. Hit Start above — each scanned email lands here; click a prompt or
              response row to read exactly what the model saw and returned.
            </p>
          ) : (
            <>
              <TraceLegend />
              {/* The newest checkpoint is what the agent is working on, but only
                  while it genuinely is: a held run spins nothing, a pause still
                  winding down does. A finished/idle pass marks no row active. */}
              <TraceRowList
                events={events}
                activeSeq={
                  (state === 'running' || state === 'pausing') && events.length > 0
                    ? (events.at(-1)?.seq ?? null)
                    : null
                }
              />
            </>
          )}
        </div>
        {/* Footer inside the scroll region and stuck to the bottom, so it's the
            same frosted glass as the funnel — the rows scroll visibly UNDER it. */}
        <footer className="glass-panel label-caps sticky bottom-0 z-10 border-t border-border px-3 py-2">
          {funnel !== null
            ? `${funnel.stats.jobsKept} job${funnel.stats.jobsKept === 1 ? '' : 's'} · ${funnel.stats.emailsProcessed}/${funnel.stats.emailsTotal} emails`
            : events.length === 0
              ? 'Idle'
              : `${events.length} checkpoint${events.length === 1 ? '' : 's'}`}
        </footer>
      </ScrollArea>
    </aside>
  )
}
