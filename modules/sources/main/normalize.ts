// Pure text-normalization helpers shared by all providers (PLAN.md §4.4).
// Conservative on purpose: a false dedupe merge hides a job; a missed merge
// only shows two rows.

// Gender markers German boards append to titles: (m/w/d), (w/m/d), (f/m/d),
// (m/f/d), (m/w/x), bare m/w/d, … — 2–4 single letters joined by slashes.
const GENDER_MARKER_RE = /\(?\s*\b[mwfdxh](?:\s*\/\s*[mwfdxh]){1,3}\b\s*\)?/gi
const ALL_GENDERS_RE = /\(\s*all\s+genders?\s*\)/gi

// Trailing legal-suffix tokens stripped from company names (after punctuation
// collapse, so "GmbH & Co. KG" → "gmbh co kg" and "e.V." → "e v").
const LEGAL_SUFFIX_TOKENS: ReadonlySet<string> = new Set([
  'gmbh',
  'mbh',
  'se',
  'ag',
  'inc',
  'ltd',
  'llc',
  'kg',
  'co',
  'ug',
  'ev',
  'e',
  'v',
])

// Lowercase + collapse every non-alphanumeric run to a single space. \p{L}
// keeps unicode letters intact (münchen stays münchen — never crash, never
// mangle umlauts).
function collapseKey(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function stripLegalSuffixes(companyKey: string): string {
  const tokens = companyKey.split(' ')
  // Never strip below one token — a company literally named "Co" survives.
  while (tokens.length > 1 && LEGAL_SUFFIX_TOKENS.has(tokens[tokens.length - 1] ?? '')) tokens.pop()
  return tokens.join(' ')
}

export function buildDedupeKey(
  company: string,
  title: string,
  locationHint: string | null,
): string {
  const companyKey = stripLegalSuffixes(collapseKey(company))
  const titleKey = collapseKey(title.replace(GENDER_MARKER_RE, ' ').replace(ALL_GENDERS_RE, ' '))
  const locationKey = locationHint === null ? '' : collapseKey(locationHint)
  return `${companyKey}|${titleKey}|${locationKey}`
}

export function cleanText(input: string): string {
  return (
    input
      // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control chars is the point
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

// Tags → space, the handful of entities job boards actually emit decoded,
// whitespace collapsed. For text excerpts only — rendered descriptions go
// through dompurify instead.
export function stripHtml(input: string): string {
  const decoded = input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
  return cleanText(decoded)
}

// Provider dates arrive as ISO strings (most), unix seconds (Arbeitnow
// created_at, RemoteOK epoch), unix ms, or Date. Numbers < 10^12 are treated
// as seconds, larger as ms. Anything invalid → null, never a crash.
export function toIsoOrNull(input: string | number | Date | null | undefined): string | null {
  if (input === null || input === undefined) return null
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input.toISOString()
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null
    const ms = Math.abs(input) < 1e12 ? input * 1000 : input
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }
  const trimmed = input.trim()
  if (trimmed === '') return null
  const date = new Date(trimmed)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
