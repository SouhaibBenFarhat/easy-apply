import { Card, CardContent, CardHeader, Skeleton } from '@ui-kit'
import type { ReactElement } from 'react'

// Layout-matching placeholder for the provider cards, shown only when
// useDeferredLoading decides the load is slow enough to warrant it.
export function SourcesSkeleton(): ReactElement {
  return (
    <div className="space-y-4" role="status" aria-label="Loading sources">
      {[0, 1, 2].map((index) => (
        <Card key={index}>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="ml-auto h-5 w-9 rounded-full" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-64" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
