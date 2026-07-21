import { Skeleton } from '@ui-kit'
import type { ReactElement } from 'react'

// Mirrors JobDetailPane's layout block for block (header: title, meta line,
// badge row, action row; body: notes and description lines) so the
// skeleton→content swap shifts nothing — PLAN.md §4.8 zero-shift rule.
export function JobDetailSkeleton(): ReactElement {
  return (
    <div className="h-full min-h-0" role="status" aria-label="Loading job details">
      <div className="flex flex-col gap-2 border-b border-border-subtle px-6 py-4">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-3.5 w-56" />
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-[22px] w-16 rounded-full" />
          <Skeleton className="h-[22px] w-16 rounded-full" />
          <Skeleton className="h-[22px] w-20 rounded-full" />
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <div className="space-y-6 px-6 py-4">
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-12" />
          <Skeleton className="h-20 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
      </div>
    </div>
  )
}
