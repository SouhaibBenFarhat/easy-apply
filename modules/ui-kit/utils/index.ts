import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

const RELATIVE_STEPS: ReadonlyArray<readonly [number, Intl.RelativeTimeFormatUnit]> = [
  [60, 'second'],
  [60, 'minute'],
  [24, 'hour'],
  [7, 'day'],
  [4.348, 'week'],
  [12, 'month'],
  [Number.POSITIVE_INFINITY, 'year'],
]

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  let delta = (then - now.getTime()) / 1000
  const format = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  for (const [step, unit] of RELATIVE_STEPS) {
    if (Math.abs(delta) < step) return format.format(Math.round(delta), unit)
    delta /= step
  }
  return ''
}
