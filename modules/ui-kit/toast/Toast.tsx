import * as ToastPrimitive from '@radix-ui/react-toast'
import { cva } from 'class-variance-authority'
import { X } from 'lucide-react'
import type { ComponentProps, ReactElement } from 'react'

import { cn } from '../utils'
import type { ToastVariant } from './use-toast'
import { useToast } from './use-toast'

export type ToastProviderProps = ComponentProps<typeof ToastPrimitive.Provider>

export function ToastProvider(props: ToastProviderProps): ReactElement {
  return <ToastPrimitive.Provider {...props} />
}

export type ToastViewportProps = ComponentProps<typeof ToastPrimitive.Viewport>

export function ToastViewport({ className, ...props }: ToastViewportProps): ReactElement {
  return (
    <ToastPrimitive.Viewport
      className={cn(
        'fixed bottom-4 right-4 z-50 flex w-96 max-w-full flex-col gap-2 outline-none',
        className,
      )}
      {...props}
    />
  )
}

const toastVariants = cva(
  'glass-overlay relative grid gap-1 rounded-lg border border-border-subtle p-4 pr-8 shadow-elevation-high animate-slide-in-from-bottom data-[state=closed]:animate-fade-out',
  {
    variants: {
      variant: {
        default: '',
        destructive: 'border-destructive-border text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface ToastProps extends ComponentProps<typeof ToastPrimitive.Root> {
  variant?: ToastVariant
}

export function Toast({ className, variant, ...props }: ToastProps): ReactElement {
  return <ToastPrimitive.Root className={cn(toastVariants({ variant }), className)} {...props} />
}

export type ToastTitleProps = ComponentProps<typeof ToastPrimitive.Title>

export function ToastTitle({ className, ...props }: ToastTitleProps): ReactElement {
  return <ToastPrimitive.Title className={cn('text-sm font-semibold', className)} {...props} />
}

export type ToastDescriptionProps = ComponentProps<typeof ToastPrimitive.Description>

export function ToastDescription({ className, ...props }: ToastDescriptionProps): ReactElement {
  return (
    <ToastPrimitive.Description
      className={cn('text-sm text-foreground-muted', className)}
      {...props}
    />
  )
}

export type ToastCloseProps = ComponentProps<typeof ToastPrimitive.Close>

export function ToastClose({ className, ...props }: ToastCloseProps): ReactElement {
  return (
    <ToastPrimitive.Close
      type="button"
      aria-label="Close"
      className={cn(
        'absolute right-2 top-2 rounded-sm p-1 text-foreground-muted transition-colors duration-fast',
        'hover:bg-interactive-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    >
      <X className="size-4" />
    </ToastPrimitive.Close>
  )
}

export function Toaster(): ReactElement {
  const { toasts, dismiss } = useToast()
  return (
    <ToastProvider>
      {toasts.map((item) => (
        <Toast
          key={item.id}
          variant={item.variant}
          onOpenChange={(open) => {
            if (!open) {
              dismiss(item.id)
            }
          }}
        >
          <ToastTitle>{item.title}</ToastTitle>
          {item.description !== undefined && (
            <ToastDescription>{item.description}</ToastDescription>
          )}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
