import type { JobSalary, JobStatus } from '@sources/shared'
import { formatSalaryCompact, statusLabel } from './format'

function salary(overrides: Partial<JobSalary> = {}): JobSalary {
  return {
    min: null,
    max: null,
    currency: null,
    period: null,
    isEstimated: false,
    raw: null,
    ...overrides,
  }
}

describe('formatSalaryCompact', () => {
  const cases: Array<[string, Partial<JobSalary>, string | null]> = [
    ['no bounds at all', {}, null],
    ['both bounds in EUR', { min: 60000, max: 80000, currency: 'EUR' }, '€60k–€80k'],
    ['lower bound only', { min: 60000, currency: 'EUR' }, '€60k+'],
    ['upper bound only', { max: 80000, currency: 'EUR' }, 'up to €80k'],
    ['USD (RemoteOK)', { min: 70000, max: 90000, currency: 'USD' }, '$70k–$90k'],
    ['lowercase currency code', { min: 50000, currency: 'eur' }, '€50k+'],
    [
      'unknown currency keeps its code',
      { min: 45000, max: 55000, currency: 'CHF' },
      'CHF 45k–CHF 55k',
    ],
    ['null currency defaults to EUR', { min: 60000, max: 80000 }, '€60k–€80k'],
    ['sub-1000 values stay unabbreviated', { min: 40, max: 60, currency: 'EUR' }, '€40–€60'],
    [
      'minimal on purpose: thousands round whole, no decimals',
      { min: 62500, max: 87500 },
      '€63k–€88k',
    ],
    [
      'minimal on purpose: no ~ marker even when estimated',
      { min: 60000, max: 80000, isEstimated: true },
      '€60k–€80k',
    ],
  ]

  it.each(cases)('%s', (_name, overrides, expected) => {
    expect(formatSalaryCompact(salary(overrides))).toBe(expected)
  })
})

describe('statusLabel', () => {
  const cases: Array<[JobStatus, string]> = [
    ['interested', 'Interested'],
    ['applied', 'Applied'],
    ['interview', 'Interview'],
    ['rejected', 'Rejected'],
  ]

  it.each(cases)('%s → %s', (status, expected) => {
    expect(statusLabel(status)).toBe(expected)
  })
})
