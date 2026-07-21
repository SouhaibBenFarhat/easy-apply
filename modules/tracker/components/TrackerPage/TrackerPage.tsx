import { useFeed, useSetJobStatus, useSources } from '@data'
import type { JobStatus, StoredJob } from '@sources/shared'
import type { BadgeProps } from '@ui-kit'
import { Badge, EmptyState, ListMenu, ScrollArea, useDeferredLoading } from '@ui-kit'
import { ClipboardList } from 'lucide-react'
import type { ReactElement } from 'react'
import { useMemo } from 'react'
import { statusLabel } from '../../lib/format'
import { TrackerRow } from '../TrackerRow'
import { TrackerSkeleton } from './TrackerSkeleton'

// Pipeline order (§6): the journey a tracked job travels through the funnel.
const PIPELINE: readonly JobStatus[] = ['interested', 'applied', 'interview', 'rejected']

type BadgeVariant = NonNullable<BadgeProps['variant']>

// §5.4 status → color mapping: interested warning · applied success ·
// interview info · rejected destructive.
const STATUS_VARIANTS: Record<JobStatus, BadgeVariant> = {
  interested: 'warning',
  applied: 'success',
  interview: 'info',
  rejected: 'destructive',
}

// The tracker orchestrator — the only tracker component that touches @data.
// Unlike FeedPage, this page never writes lastFeedVisit: checking the pipeline
// must not consume the feed's "new since last visit" divider.
export function TrackerPage(): ReactElement {
  // One wide feed query, hidden rows included: tracked jobs stay visible here
  // even when hidden from the feed. Tracking is the client-side cut below —
  // jobs with a status.
  const feed = useFeed({ limit: 500, includeHidden: true })
  const sources = useSources()
  const setStatus = useSetJobStatus()

  const sourceNames = useMemo(() => {
    const names: Record<string, string> = {}
    for (const info of sources.data ?? []) names[info.sourceId] = info.displayName
    return names
  }, [sources.data])

  const jobs = feed.data
  const groups = useMemo(() => {
    const byStatus: Record<JobStatus, StoredJob[]> = {
      interested: [],
      applied: [],
      interview: [],
      rejected: [],
    }
    for (const job of jobs ?? []) {
      if (job.status !== null) byStatus[job.status].push(job)
    }
    return byStatus
  }, [jobs])

  const loading = useDeferredLoading(feed.isLoading)

  if (jobs === undefined) {
    // Anti-flash: sub-150ms loads render nothing rather than a skeleton blink.
    return loading === 'skeleton' ? <TrackerSkeleton /> : <div className="h-full" />
  }

  if (PIPELINE.every((status) => groups[status].length === 0)) {
    return (
      <EmptyState
        className="h-full"
        icon={<ClipboardList className="size-5" />}
        title="Nothing tracked yet"
        description="Mark jobs as Interested or Applied in the Feed and they show up here."
      />
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-3xl space-y-8 p-6">
        {PIPELINE.map((status) => {
          const group = groups[status]
          if (group.length === 0) return null
          return (
            <section key={status}>
              <header className="mb-2 flex items-center gap-2">
                <h2 className="label-caps">{statusLabel(status)}</h2>
                <Badge variant={STATUS_VARIANTS[status]}>{group.length}</Badge>
              </header>
              <ListMenu>
                {group.map((job) => (
                  <TrackerRow
                    key={job.id}
                    job={job}
                    sourceName={sourceNames[job.sourceId] ?? job.sourceId}
                    onSetStatus={(id, next) => setStatus.mutate({ id, status: next })}
                  />
                ))}
              </ListMenu>
            </section>
          )
        })}
      </div>
    </ScrollArea>
  )
}
