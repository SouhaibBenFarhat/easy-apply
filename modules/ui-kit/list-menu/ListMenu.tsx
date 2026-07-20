import type { ComponentProps, ReactElement, ReactNode } from 'react'
import { cn } from '../utils'

export interface ListMenuProps extends ComponentProps<'div'> {}

export function ListMenu({ className, ...props }: ListMenuProps): ReactElement {
  return <div role="menu" className={cn('flex flex-col', className)} {...props} />
}

export interface ListMenuItemProps extends ComponentProps<'button'> {
  selected?: boolean
  description?: string
  trailing?: ReactNode
}

export function ListMenuItem({
  className,
  selected,
  description,
  trailing,
  children,
  ...props
}: ListMenuItemProps): ReactElement {
  return (
    <button
      type="button"
      role="menuitem"
      data-selected={selected}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-interactive-hover data-[selected=true]:bg-primary/15',
        className,
      )}
      {...props}
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{children}</span>
        {description ? (
          <span className="truncate text-xs text-foreground-muted">{description}</span>
        ) : null}
      </span>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </button>
  )
}

export interface ListMenuGroupLabelProps extends ComponentProps<'div'> {}

export function ListMenuGroupLabel({ className, ...props }: ListMenuGroupLabelProps): ReactElement {
  return <div className={cn('label-caps px-3 py-1.5', className)} {...props} />
}

export interface ListMenuSeparatorProps extends ComponentProps<'div'> {}

export function ListMenuSeparator({ className, ...props }: ListMenuSeparatorProps): ReactElement {
  return <div className={cn('my-1 h-px bg-border-muted', className)} {...props} />
}
