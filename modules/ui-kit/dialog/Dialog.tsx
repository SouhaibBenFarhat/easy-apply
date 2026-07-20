import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ComponentProps, ReactElement } from 'react'

import { cn } from '../utils'

export type DialogProps = ComponentProps<typeof DialogPrimitive.Root>

export function Dialog(props: DialogProps): ReactElement {
  return <DialogPrimitive.Root {...props} />
}

export type DialogTriggerProps = ComponentProps<typeof DialogPrimitive.Trigger>

export function DialogTrigger({ type = 'button', ...props }: DialogTriggerProps): ReactElement {
  return <DialogPrimitive.Trigger type={type} {...props} />
}

export type DialogCloseProps = ComponentProps<typeof DialogPrimitive.Close>

export function DialogClose({ type = 'button', ...props }: DialogCloseProps): ReactElement {
  return <DialogPrimitive.Close type={type} {...props} />
}

export type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content>

export function DialogContent({ className, children, ...props }: DialogContentProps): ReactElement {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn('fixed inset-0 z-50 bg-background/40 backdrop-blur-[8px] animate-fade-in')}
      />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg',
          'glass-overlay border border-border-subtle rounded-xl shadow-elevation-high p-6',
          'animate-scale-in',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          type="button"
          className={cn(
            'absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded-sm',
            'text-foreground-muted transition-colors duration-fast hover:bg-interactive-hover',
            'hover:text-foreground focus-visible:outline-none focus-visible:ring-2',
            'focus-visible:ring-ring [&_svg]:size-4',
          )}
        >
          <X aria-hidden="true" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export type DialogHeaderProps = ComponentProps<'div'>

export function DialogHeader({ className, ...props }: DialogHeaderProps): ReactElement {
  return <div className={cn('flex flex-col gap-1.5 text-left', className)} {...props} />
}

export type DialogFooterProps = ComponentProps<'div'>

export function DialogFooter({ className, ...props }: DialogFooterProps): ReactElement {
  return <div className={cn('mt-6 flex justify-end gap-2', className)} {...props} />
}

export type DialogTitleProps = ComponentProps<typeof DialogPrimitive.Title>

export function DialogTitle({ className, ...props }: DialogTitleProps): ReactElement {
  return (
    <DialogPrimitive.Title
      className={cn('text-lg font-semibold text-foreground', className)}
      {...props}
    />
  )
}

export type DialogDescriptionProps = ComponentProps<typeof DialogPrimitive.Description>

export function DialogDescription({ className, ...props }: DialogDescriptionProps): ReactElement {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm text-foreground-muted', className)}
      {...props}
    />
  )
}
