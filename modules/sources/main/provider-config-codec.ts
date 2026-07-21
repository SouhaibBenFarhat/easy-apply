// Provider API-key config codec (PLAN.md §4.9). The safeStorage half lives in
// src/main/provider-config.ts (electron glue, coverage-excluded); this half is
// the pure JSON layer so the encode/decode rules stay unit-testable.
// encodeProviderConfig(values) is what gets encrypted; decodeProviderConfig is
// applied to whatever decrypts — and whatever decrypts is untrusted (another
// machine's keychain, a corrupted row, schema drift), so anything that is not
// a flat string map degrades to {} instead of throwing.

export function encodeProviderConfig(values: Record<string, string>): string {
  return JSON.stringify(values)
}

export function decodeProviderConfig(json: string | null): Record<string, string> {
  if (json === null) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return {}
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
  const values: Record<string, string> = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'string') values[key] = value
  }
  return values
}
