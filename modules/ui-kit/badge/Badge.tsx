import { cva } from 'class-variance-authority'
import type { ComponentProps, ReactElement } from 'react'
import { cn } from '../utils'

export type BadgeVariant =
  | 'default'
  | 'copper'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info'
  | 'outline'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'bg-surface-raised border-border text-foreground',
        copper: 'bg-primary/15 border-primary/40 text-primary',
        success: 'bg-success-subtle border-success-border text-success',
        warning: 'bg-warning-subtle border-warning-border text-warning',
        destructive: 'bg-destructive-subtle border-destructive-border text-destructive',
        info: 'bg-info-subtle border-info-border text-info',
        outline: 'border-border text-foreground-muted bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps extends ComponentProps<'span'> {
  variant?: BadgeVariant
}

export function Badge({ className, variant, ...props }: BadgeProps): ReactElement {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
