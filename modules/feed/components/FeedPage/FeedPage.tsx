import {
  useFeed,
  useJob,
  useLastFeedVisit,
  useMarkFeedVisited,
  useSetJobHidden,
  useSetJobNotes,
  useSetJobStatus,
  useSetStoredFeedFilters,
  useSources,
  useStoredFeedFilters,
} from '@data'
import type { FeedFilters } from '@sources/shared'
import { Button, EmptyState, useDeferredLoading } from '@ui-kit'
import { FilterX, Inbox } from 'lucide-react'
import type { ReactElement } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { FilterBar } from '../FilterBar'
import { JobDetailPane } from '../JobDetailPane'
import { JobList } from '../JobList'
import { FeedSkeleton } from './FeedSkeleton'

function hasActiveFilters(filters: FeedFilters): boolean {
  return (
    filters.workModes !== undefined ||
    filters.sources !== undefined ||
    filters.hasSalary !== undefined
  )
}

// The feed orchestrator — the only feed component that touches @data. Layout
// per §6: 420px master column (filter bar + virtualized list) and a flexible
// detail pane. Selection is plain local state; the PLAN's ?job= search-param
// idea is deliberately dropped (deviation) to keep the router untouched.
export function FeedPage(): ReactElement {
  // The tab/toggle/source configuration is remembered across restarts (the
  // `local` persistence namespace); the search text is ephemeral by design.
  const storedFilters = useStoredFeedFilters()
  const setStoredFilters = useSetStoredFeedFilters()
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  // Search-by-company was removed: the filter bar is now tabs + a gear popover
  // (work mode / salary / sources), all persisted config.
  const filters = useMemo<FeedFilters>(() => storedFilters.data ?? {}, [storedFilters.data])
  const setFilters = (next: FeedFilters): void => {
    setStoredFilters.mutate(next)
  }

  const feed = useFeed(filters)
  const sources = useSources()
  const lastVisit = useLastFeedVisit()
  const markVisited = useMarkFeedVisited()
  const setStatus = useSetJobStatus()
  const setNotes = useSetJobNotes()
  const setHidden = useSetJobHidden()

  // The "new since last visit" watermark moves when the user looks away:
  // window blur and page unmount both count as the end of a visit.
  const markVisitedMutate = markVisited.mutate
  useEffect(() => {
    const onBlur = (): void => {
      markVisitedMutate()
    }
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('blur', onBlur)
      markVisitedMutate()
    }
  }, [markVisitedMutate])

  const sourceNames = useMemo(() => {
    const names: Record<string, string> = {}
    for (const info of sources.data ?? []) names[info.sourceId] = info.displayName
    return names
  }, [sources.data])

  // The selected job usually lives in the filtered list; when a filter change
  // pushes it out, fall back to fetching it directly so the pane holds steady.
  const jobs = feed.data
  const selectedFromList = useMemo(
    () => (jobs ?? []).find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId],
  )
  const fallbackJob = useJob(selectedFromList === null ? selectedJobId : null)
  const selectedJob = selectedFromList ?? fallbackJob.data ?? null

  const loading = useDeferredLoading(feed.isLoading)

  if (jobs === undefined) {
    // Anti-flash: sub-150ms loads render nothing rather than a skeleton blink.
    return loading === 'skeleton' ? <FeedSkeleton /> : <div className="h-full" />
  }

  if (jobs.length === 0 && !hasActiveFilters(filters)) {
    return (
      <EmptyState
        className="h-full"
        icon={<Inbox className="size-5" />}
        title="No jobs yet"
        description="Sources sync on launch — try Sync now in the header."
      />
    )
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Job-list sidebar (§sidebars): body `background`, header (FilterBar) +
          footer one step up on `surface`. */}
      <div className="flex w-[420px] shrink-0 flex-col border-r border-border bg-background">
        <FilterBar filters={filters} sources={sources.data ?? []} onChange={setFilters} />
        {jobs.length === 0 ? (
          <EmptyState
            className="flex-1"
            icon={<FilterX className="size-5" />}
            title="Nothing matches these filters"
            action={
              <Button
                variant="ghost"
                onClick={() => {
                  setFilters({})
                }}
              >
                Reset filters
              </Button>
            }
          />
        ) : (
          <JobList
            jobs={jobs}
            selectedId={selectedJobId}
            onSelect={setSelectedJobId}
            newSince={lastVisit.data ?? null}
            sourceNames={sourceNames}
          />
        )}
        <footer className="label-caps shrink-0 border-t border-border bg-surface-hover px-3 py-2">
          {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}
        </footer>
      </div>
      <div className="min-w-0 flex-1">
        <JobDetailPane
          job={selectedJob}
          sourceName={selectedJob !== null ? (sourceNames[selectedJob.sourceId] ?? null) : null}
          onSetStatus={(status) => {
            if (selectedJob !== null) setStatus.mutate({ id: selectedJob.id, status })
          }}
          onSetNotes={(notes) => {
            if (selectedJob !== null) setNotes.mutate({ id: selectedJob.id, notes })
          }}
          onHide={() => {
            if (selectedJob !== null) {
              setHidden.mutate({ id: selectedJob.id, hidden: true })
              setSelectedJobId(null)
            }
          }}
        />
      </div>
    </div>
  )
}
