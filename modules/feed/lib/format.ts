import type { JobSalary, RemoteScope, WorkMode } from '@sources/shared'

// Compact money: 60000 → "60k", 1500 → "1.5k", 40 → "40" (hourly rates stay
// as-is). Salary strings stay short — they live inside a feed-row badge.
function compact(value: number): string {
  if (value < 1000) return `${Math.round(value)}`
  const thousands = value / 1000
  const rounded = Math.round(thousands * 10) / 10
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded}k`
}

function currencySymbol(currency: string | null): string {
  // EUR is the app's home currency (Munich + remote-EU) and doubles as the
  // default when a source omits the code; RemoteOK reports USD.
  if (currency === null) return '€'
  const code = currency.toUpperCase()
  if (code === 'EUR') return '€'
  if (code === 'USD') return '$'
  return `${code} `
}

// "€60k–€80k" · "€60k+" · "up to €80k" · "~€60k–€80k" when estimated.
// Returns null when the salary carries no bounds at all.
export function formatSalary(salary: JobSalary): string | null {
  const { min, max } = salary
  const symbol = currencySymbol(salary.currency)
  const prefix = salary.isEstimated ? '~' : ''
  if (min !== null && max !== null)
    return `${prefix}${symbol}${compact(min)}–${symbol}${compact(max)}`
  if (min !== null) return `${prefix}${symbol}${compact(min)}+`
  if (max !== null) return `${prefix}up to ${symbol}${compact(max)}`
  return null
}

const WORK_MODE_LABELS: Record<WorkMode, string> = {
  onsite: 'On-site',
  hybrid: 'Hybrid',
  remote: 'Remote',
  // Unknown renders as nothing — an empty fixed-width slot keeps row columns
  // aligned without shouting "?" at the reader (§5.4 scannability).
  unknown: '',
}

export function workModeLabel(mode: WorkMode): string {
  return WORK_MODE_LABELS[mode]
}

const REMOTE_SCOPE_LABELS: Record<RemoteScope, string> = {
  germany: 'Germany',
  europe: 'Europe',
  worldwide: 'Worldwide',
}

export function remoteScopeLabel(scope: RemoteScope): string {
  return REMOTE_SCOPE_LABELS[scope]
}
