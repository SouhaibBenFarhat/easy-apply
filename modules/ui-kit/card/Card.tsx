import type { ComponentProps, ReactElement } from 'react'
import { cn } from '../utils'

export type CardProps = ComponentProps<'div'>

export function Card({ className, ...props }: CardProps): ReactElement {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface-raised text-foreground shadow-elevation-low',
        className,
      )}
      {...props}
    />
  )
}

export type CardHeaderProps = ComponentProps<'div'>

export function CardHeader({ className, ...props }: CardHeaderProps): ReactElement {
  return <div className={cn('flex flex-col space-y-1.5 p-4', className)} {...props} />
}

export type CardTitleProps = ComponentProps<'h3'>

export function CardTitle({ className, ...props }: CardTitleProps): ReactElement {
  return <h3 className={cn('text-lg font-semibold tracking-tight', className)} {...props} />
}

export type CardDescriptionProps = ComponentProps<'p'>

export function CardDescription({ className, ...props }: CardDescriptionProps): ReactElement {
  return <p className={cn('text-sm text-foreground-muted', className)} {...props} />
}

export type CardContentProps = ComponentProps<'div'>

export function CardContent({ className, ...props }: CardContentProps): ReactElement {
  return <div className={cn('p-4 pt-0', className)} {...props} />
}

export type CardFooterProps = ComponentProps<'div'>

export function CardFooter({ className, ...props }: CardFooterProps): ReactElement {
  return <div className={cn('flex items-center p-4 pt-0', className)} {...props} />
}
