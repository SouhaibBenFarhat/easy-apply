import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import type { ComponentProps, ReactElement } from 'react'

import { cn } from '../utils'

export type SelectProps = ComponentProps<typeof SelectPrimitive.Root>

export function Select(props: SelectProps): ReactElement {
  return <SelectPrimitive.Root {...props} />
}

export type SelectGroupProps = ComponentProps<typeof SelectPrimitive.Group>

export function SelectGroup(props: SelectGroupProps): ReactElement {
  return <SelectPrimitive.Group {...props} />
}

export type SelectValueProps = ComponentProps<typeof SelectPrimitive.Value>

export function SelectValue(props: SelectValueProps): ReactElement {
  return <SelectPrimitive.Value {...props} />
}

export type SelectTriggerProps = ComponentProps<typeof SelectPrimitive.Trigger>

export function SelectTrigger({
  className,
  children,
  type = 'button',
  ...props
}: SelectTriggerProps): ReactElement {
  return (
    <SelectPrimitive.Trigger
      type={type}
      className={cn(
        'field-recess flex h-9 w-full items-center justify-between rounded border border-border bg-input',
        'px-3 py-2 text-sm transition-colors duration-fast',
        'data-[placeholder]:text-foreground-subtle',
        'focus:outline-none focus:ring-1 focus:ring-ring',
        'disabled:pointer-events-none disabled:opacity-40',
        '[&>span]:line-clamp-1',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-4 shrink-0 text-foreground-muted" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

export type SelectScrollUpButtonProps = ComponentProps<typeof SelectPrimitive.ScrollUpButton>

export function SelectScrollUpButton({
  className,
  ...props
}: SelectScrollUpButtonProps): ReactElement {
  return (
    <SelectPrimitive.ScrollUpButton
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      {...props}
    >
      <ChevronUp className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  )
}

export type SelectScrollDownButtonProps = ComponentProps<typeof SelectPrimitive.ScrollDownButton>

export function SelectScrollDownButton({
  className,
  ...props
}: SelectScrollDownButtonProps): ReactElement {
  return (
    <SelectPrimitive.ScrollDownButton
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      {...props}
    >
      <ChevronDown className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  )
}

export type SelectContentProps = ComponentProps<typeof SelectPrimitive.Content>

export function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: SelectContentProps): ReactElement {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        className={cn(
          'relative z-50 max-h-96 min-w-32 overflow-hidden rounded-lg border border-border-subtle',
          'bg-overlay text-foreground shadow-elevation-high animate-scale-in',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1',
          className,
        )}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            'p-1',
            position === 'popper' &&
              'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]',
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

export type SelectLabelProps = ComponentProps<typeof SelectPrimitive.Label>

export function SelectLabel({ className, ...props }: SelectLabelProps): ReactElement {
  return <SelectPrimitive.Label className={cn('label-caps px-2 py-1.5', className)} {...props} />
}

export type SelectItemProps = ComponentProps<typeof SelectPrimitive.Item>

export function SelectItem({ className, children, ...props }: SelectItemProps): ReactElement {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2',
        'text-sm outline-none focus:bg-interactive-hover',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

export type SelectSeparatorProps = ComponentProps<typeof SelectPrimitive.Separator>

export function SelectSeparator({ className, ...props }: SelectSeparatorProps): ReactElement {
  return (
    <SelectPrimitive.Separator
      className={cn('-mx-1 my-1 h-px bg-border-subtle', className)}
      {...props}
    />
  )
}
