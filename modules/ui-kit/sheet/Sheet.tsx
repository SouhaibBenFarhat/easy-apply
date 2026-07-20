import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ComponentProps, ReactElement } from 'react'

import { cn } from '../utils'

export type SheetProps = ComponentProps<typeof DialogPrimitive.Root>

export function Sheet(props: SheetProps): ReactElement {
  return <DialogPrimitive.Root {...props} />
}

export type SheetTriggerProps = ComponentProps<typeof DialogPrimitive.Trigger>

export function SheetTrigger({ type = 'button', ...props }: SheetTriggerProps): ReactElement {
  return <DialogPrimitive.Trigger type={type} {...props} />
}

export type SheetCloseProps = ComponentProps<typeof DialogPrimitive.Close>

export function SheetClose({ type = 'button', ...props }: SheetCloseProps): ReactElement {
  return <DialogPrimitive.Close type={type} {...props} />
}

export type SheetSide = 'right' | 'left' | 'bottom'

const sideClasses: Record<SheetSide, string> = {
  right: 'inset-y-0 right-0 h-full w-3/4 max-w-sm border-l',
  left: 'inset-y-0 left-0 h-full w-3/4 max-w-sm border-r',
  bottom: 'inset-x-0 bottom-0 border-t',
}

export interface SheetContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  side?: SheetSide
}

export function SheetContent({
  side = 'right',
  className,
  children,
  ...props
}: SheetContentProps): ReactElement {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn('fixed inset-0 z-50 bg-background/40 backdrop-blur-[8px] animate-fade-in')}
      />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 bg-surface border-border-subtle shadow-elevation-high p-6',
          sideClasses[side],
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          type="button"
          className={cn(
            'absolute right-4 top-4 rounded-sm text-foreground-muted transition-colors duration-fast',
            'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <X className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export type SheetHeaderProps = ComponentProps<'div'>

export function SheetHeader({ className, ...props }: SheetHeaderProps): ReactElement {
  return <div className={cn('flex flex-col gap-1.5', className)} {...props} />
}

export type SheetTitleProps = ComponentProps<typeof DialogPrimitive.Title>

export function SheetTitle({ className, ...props }: SheetTitleProps): ReactElement {
  return (
    <DialogPrimitive.Title
      className={cn('text-lg font-semibold text-foreground', className)}
      {...props}
    />
  )
}

export type SheetDescriptionProps = ComponentProps<typeof DialogPrimitive.Description>

export function SheetDescription({ className, ...props }: SheetDescriptionProps): ReactElement {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm text-foreground-muted', className)}
      {...props}
    />
  )
}
