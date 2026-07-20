import { cn, formatRelativeTime } from './index'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b')
  })

  it('resolves conflicting tailwind classes to the last one', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})

describe('formatRelativeTime', () => {
  const now = new Date('2026-07-21T12:00:00Z')

  it('formats seconds ago', () => {
    expect(formatRelativeTime('2026-07-21T11:59:30Z', now)).toContain('second')
  })

  it('formats minutes ago', () => {
    expect(formatRelativeTime('2026-07-21T11:15:00Z', now)).toBe('45 minutes ago')
  })

  it('formats hours ago', () => {
    expect(formatRelativeTime('2026-07-21T06:00:00Z', now)).toBe('6 hours ago')
  })

  it('formats days ago', () => {
    expect(formatRelativeTime('2026-07-18T12:00:00Z', now)).toBe('3 days ago')
  })

  it('formats weeks and months ago', () => {
    expect(formatRelativeTime('2026-07-04T12:00:00Z', now)).toContain('week')
    expect(formatRelativeTime('2026-04-21T12:00:00Z', now)).toContain('month')
  })

  it('formats years ago', () => {
    expect(formatRelativeTime('2024-05-21T12:00:00Z', now)).toContain('year')
  })

  it('formats future times', () => {
    expect(formatRelativeTime('2026-07-21T14:00:00Z', now)).toContain('in 2 hours')
  })

  it('returns empty string for invalid input', () => {
    expect(formatRelativeTime('not-a-date', now)).toBe('')
  })
})
