import type { ComponentProps, ReactElement, ReactNode } from 'react'

import { cn } from '../utils'

export interface EmptyStateProps extends ComponentProps<'section'> {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({
  className,
  icon,
  title,
  description,
  action,
  ...props
}: EmptyStateProps): ReactElement {
  return (
    <section
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-16 text-center animate-fade-in',
        className,
      )}
      {...props}
    >
      {icon ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface text-foreground-subtle">
          {icon}
        </div>
      ) : null}
      <h2 className="text-sm font-semibold">{title}</h2>
      {description ? <p className="max-w-sm text-sm text-foreground-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </section>
  )
}
