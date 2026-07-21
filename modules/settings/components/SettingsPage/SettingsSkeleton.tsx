import { Card, CardContent, CardHeader, Skeleton } from '@ui-kit'
import type { ReactElement } from 'react'

// Layout-matching placeholder for the three settings cards, shown only when
// useDeferredLoading decides the load is slow enough to warrant it.
export function SettingsSkeleton(): ReactElement {
  return (
    <div className="space-y-8" role="status" aria-label="Loading settings">
      {[0, 1, 2].map((index) => (
        <Card key={index}>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
