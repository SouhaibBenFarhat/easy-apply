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
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div
            key={index}
            className="flex h-[76px] flex-col justify-center gap-1.5 border-b border-border-subtle px-3 py-2"
          >
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex items-center gap-1">
              <Skeleton className="h-[22px] w-14 rounded-full" />
              <Skeleton className="h-[22px] w-20 rounded-full" />
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
