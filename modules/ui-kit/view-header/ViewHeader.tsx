import type { ComponentProps, ReactElement } from 'react'
import { cn } from '../utils'

export interface ViewHeaderProps extends Omit<ComponentProps<'header'>, 'title'> {
  title: string
  subtitle?: string
}

export function ViewHeader({
  className,
  title,
  subtitle,
  children,
  ...props
}: ViewHeaderProps): ReactElement {
  return (
    <header
      className={cn(
        'flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-4',
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-baseline gap-3">
        <h1 className="truncate text-sm font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle ? (
          <span className="label-caps hidden truncate text-foreground-muted sm:inline">
            {subtitle}
          </span>
        ) : null}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </header>
  )
}
