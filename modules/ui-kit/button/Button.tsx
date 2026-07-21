import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import type { ComponentProps, ReactElement } from 'react'
import { cn } from '../utils'

export type ButtonVariant = 'default' | 'secondary' | 'ghost' | 'outline' | 'destructive'
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97] [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-elevation-low',
        // Neutral filled control that stays visible on ELEVATED surfaces
        // (cards): a lifted fill + full-strength border + shadow, so it never
        // merges into the surface behind it the way ghost/outline do. Use this
        // for secondary actions on cards/panels. See the visual-hierarchy skill.
        secondary:
          'border border-border bg-surface-hover text-foreground shadow-elevation-low hover:bg-interactive-active',
        ghost: 'hover:bg-interactive-hover rounded-sm',
        outline: 'border border-border bg-transparent hover:bg-interactive-hover',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs rounded-sm',
        lg: 'h-11 px-6 text-base rounded-lg',
        icon: 'h-9 w-9',
        'icon-sm': 'h-7 w-7',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: ButtonProps): ReactElement {
  if (asChild) {
    return <Slot className={cn(buttonVariants({ variant, size }), className)} {...props} />
  }
  return (
    <button
      type={type ?? 'button'}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}
