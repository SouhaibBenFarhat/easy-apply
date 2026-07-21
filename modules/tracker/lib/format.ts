import type { JobSalary, JobStatus } from '@sources/shared'

// Deliberate duplication of a slice of @feed's salary formatting: features are
// L3 and may never import each other (Biome layer rules) — the only sharing
// channel is @ui-kit, and a job-domain formatter doesn't belong in the design
// system. The tracker version stays minimal on purpose: whole-thousand "k"
// rounding straight from min/max/currency, no ~estimate marker — these are
// jobs you already vetted in the feed.
function compact(value: number): string {
  return value >= 1000 ? `${Math.round(value / 1000)}k` : `${Math.round(value)}`
}

function currencySymbol(currency: string | null): string {
  // EUR is the app's home currency and the default when a source omits it.
  const code = (currency ?? 'EUR').toUpperCase()
  if (code === 'EUR') return '€'
  if (code === 'USD') return '$'
  return `${code} `
}

// "€60k–€80k" · "€60k+" · "up to €80k" · null when the salary has no bounds.
export function formatSalaryCompact(salary: JobSalary): string | null {
  const { min, max } = salary
  const symbol = currencySymbol(salary.currency)
  if (min !== null && max !== null) return `${symbol}${compact(min)}–${symbol}${compact(max)}`
  if (min !== null) return `${symbol}${compact(min)}+`
  if (max !== null) return `up to ${symbol}${compact(max)}`
  return null
}

const STATUS_LABELS: Record<JobStatus, string> = {
  interested: 'Interested',
  applied: 'Applied',
  interview: 'Interview',
  rejected: 'Rejected',
}

export function statusLabel(status: JobStatus): string {
  return STATUS_LABELS[status]
}
