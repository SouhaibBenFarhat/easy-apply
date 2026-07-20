import type { ComponentProps, ReactElement } from 'react'
import { cn } from '../utils'

export type InputProps = ComponentProps<'input'>

export function Input({ className, type = 'text', ...props }: InputProps): ReactElement {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded border border-border bg-input px-3 py-2 text-sm',
        'placeholder:text-foreground-subtle',
        'transition-colors duration-fast',
        'focus-visible:border-primary focus-visible:bg-background focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...props}
    />
  )
}
