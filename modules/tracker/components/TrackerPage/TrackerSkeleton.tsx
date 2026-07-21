import { Skeleton } from '@ui-kit'
import type { ReactElement } from 'react'

// Layout-matching placeholder: three status sections — caps header strip plus
// two flat rows each — in the same centered column as the real page, so the
// skeleton→content swap shifts nothing (§4.8).
export function TrackerSkeleton(): ReactElement {
  return (
    <div className="h-full" role="status" aria-label="Loading tracker">
      <div className="mx-auto max-w-3xl space-y-8 p-6">
        {[0, 1, 2].map((section) => (
          <div key={section}>
            <div className="mb-2 flex items-center gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-[22px] w-8 rounded-full" />
            </div>
            {[0, 1].map((row) => (
              <div
                key={row}
                className="flex items-center gap-3 border-b border-border-subtle px-3 py-2.5 last:border-0"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-7 w-32" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
