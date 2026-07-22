import { Skeleton } from '@ui-kit'
import type { ReactElement } from 'react'
import { JobDetailSkeleton } from '../JobDetailSkeleton'

// Layout-matching placeholder for the whole master-detail split: six flat row
// skeletons under a filter-bar strip on the left, the detail skeleton on the
// right. Same column widths as FeedPage, so nothing shifts on swap (§4.8).
export function FeedSkeleton(): ReactElement {
  return (
    <div className="flex h-full min-h-0" role="status" aria-label="Loading feed">
      <div className="flex w-[420px] shrink-0 flex-col border-r border-border-subtle">
        <div className="flex flex-col gap-2 border-b border-border-subtle p-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
          <div key={index} className="px-3 pt-2.5">
            <div className="flex h-[68px] flex-col justify-center gap-1 rounded-lg border border-border bg-surface-raised px-3 py-2 shadow-elevation-low">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <JobDetailSkeleton />
      </div>
    </div>
  )
}
