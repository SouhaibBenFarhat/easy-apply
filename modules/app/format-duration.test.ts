import { formatElapsedClock, formatTraceDuration } from './format-duration'

describe('formatTraceDuration', () => {
  it.each([
    [0, '0ms'],
    [842, '842ms'],
    [999, '999ms'],
    [1000, '1.0s'],
    [1_437, '1.4s'],
    [9_940, '9.9s'],
    [10_000, '10s'],
    [42_400, '42s'],
    [60_000, '1m 00s'],
    [83_000, '1m 23s'],
    [605_000, '10m 05s'],
    [3_600_000, '1h 00m'],
    [4_320_000, '1h 12m'],
  ])('formats %ims as "%s"', (ms, expected) => {
    expect(formatTraceDuration(ms)).toBe(expected)
  })

  // Garbage in → empty string out, never NaN on screen.
  it.each([Number.NaN, -5, Number.POSITIVE_INFINITY])('renders nothing for %d', (ms) => {
    expect(formatTraceDuration(ms)).toBe('')
  })
})

describe('formatElapsedClock', () => {
  it.each([
    [0, '0:00'],
    [900, '0:00'], // floors — a stopwatch never rounds up
    [7_000, '0:07'],
    [62_000, '1:02'],
    [762_000, '12:42'],
    [3_725_000, '1:02:05'],
  ])('formats %ims as "%s"', (ms, expected) => {
    expect(formatElapsedClock(ms)).toBe(expected)
  })

  it.each([Number.NaN, -5, Number.POSITIVE_INFINITY])('renders nothing for %d', (ms) => {
    expect(formatElapsedClock(ms)).toBe('')
  })
})
