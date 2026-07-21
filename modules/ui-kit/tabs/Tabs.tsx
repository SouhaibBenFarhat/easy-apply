import * as TabsPrimitive from '@radix-ui/react-tabs'
import type { ComponentProps, ReactElement } from 'react'

import { cn } from '../utils'

export type TabsProps = ComponentProps<typeof TabsPrimitive.Root>

export function Tabs(props: TabsProps): ReactElement {
  return <TabsPrimitive.Root {...props} />
}

export type TabsListProps = ComponentProps<typeof TabsPrimitive.List>

export function TabsList({ className, ...props }: TabsListProps): ReactElement {
  return (
    <TabsPrimitive.List
      // Recessed track (§5.2): the segmented control sits a level BELOW its
      // container — dark mode: darker well; light mode: brighter paper — and
      // the active tab pops a level above it.
      className={cn(
        'inline-flex h-9 items-center gap-1 rounded-lg border border-border-subtle bg-background p-1',
        className,
      )}
      {...props}
    />
  )
}

export type TabsTriggerProps = ComponentProps<typeof TabsPrimitive.Trigger>

export function TabsTrigger({
  className,
  type = 'button',
  ...props
}: TabsTriggerProps): ReactElement {
  return (
    <TabsPrimitive.Trigger
      type={type}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1',
        'text-sm font-medium text-foreground-muted transition-all',
        'data-[state=active]:bg-surface-raised data-[state=active]:text-foreground',
        'data-[state=active]:shadow-elevation-low disabled:opacity-40',
        className,
      )}
      {...props}
    />
  )
}

export type TabsContentProps = ComponentProps<typeof TabsPrimitive.Content>

export function TabsContent({ className, ...props }: TabsContentProps): ReactElement {
  return <TabsPrimitive.Content className={cn('mt-2 outline-none', className)} {...props} />
}
