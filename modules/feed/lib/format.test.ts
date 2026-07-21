import type { JobSalary, RemoteScope, WorkMode } from '@sources/shared'
import { formatSalary, remoteScopeLabel, workModeLabel } from './format'

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

describe('formatSalary', () => {
  const cases: Array<[string, Partial<JobSalary>, string | null]> = [
    ['no bounds at all', {}, null],
    ['both bounds in EUR', { min: 60000, max: 80000, currency: 'EUR' }, '€60k–€80k'],
    ['lower bound only', { min: 60000, currency: 'EUR' }, '€60k+'],
    ['upper bound only', { max: 80000, currency: 'EUR' }, 'up to €80k'],
    [
      'estimated range',
      { min: 60000, max: 80000, currency: 'EUR', isEstimated: true },
      '~€60k–€80k',
    ],
    ['USD (RemoteOK)', { min: 70000, max: 90000, currency: 'USD' }, '$70k–$90k'],
    ['lowercase currency code', { min: 50000, currency: 'eur' }, '€50k+'],
    [
      'unknown currency keeps its code',
      { min: 45000, max: 55000, currency: 'CHF' },
      'CHF 45k–CHF 55k',
    ],
    ['null currency defaults to EUR', { min: 60000, max: 80000 }, '€60k–€80k'],
    ['sub-1000 values stay unabbreviated', { min: 40, max: 60, currency: 'EUR' }, '€40–€60'],
    ['non-integer thousands keep one decimal', { min: 62500, max: 87500 }, '€62.5k–€87.5k'],
    ['estimated single bound', { max: 65000, isEstimated: true }, '~up to €65k'],
  ]

  it.each(cases)('%s', (_name, overrides, expected) => {
    expect(formatSalary(salary(overrides))).toBe(expected)
  })
})

describe('workModeLabel', () => {
  const cases: Array<[WorkMode, string]> = [
    ['onsite', 'On-site'],
    ['hybrid', 'Hybrid'],
    ['remote', 'Remote'],
    ['unknown', '?'],
  ]

  it.each(cases)('%s → %s', (mode, expected) => {
    expect(workModeLabel(mode)).toBe(expected)
  })
})

describe('remoteScopeLabel', () => {
  const cases: Array<[RemoteScope, string]> = [
    ['germany', 'Germany'],
    ['europe', 'Europe'],
    ['worldwide', 'Worldwide'],
  ]

  it.each(cases)('%s → %s', (scope, expected) => {
    expect(remoteScopeLabel(scope)).toBe(expected)
  })
})
