import type { ComponentProps, ReactElement } from 'react'

import { cn } from '../utils'

export type SkeletonProps = ComponentProps<'div'>

export function Skeleton({ className, ...props }: SkeletonProps): ReactElement {
  return <div className={cn('animate-skeleton rounded-md bg-border-muted', className)} {...props} />
}
