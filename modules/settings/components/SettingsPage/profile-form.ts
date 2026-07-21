// Pure form parsing/clamping, mirrors the zod limits in
// modules/sources/shared/search-profile.ts so a save never trips validation.

export const MAX_KEYWORDS = 10
export const MAX_RADIUS_KM = 200

/** Comma-separated input → trimmed keywords, empties dropped, capped at 10. */
export function parseKeywords(input: string): string[] {
  return input
    .split(',')
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0)
    .slice(0, MAX_KEYWORDS)
}

/** Raw number-input string → integer radius clamped to 0–200 km. */
export function clampRadius(input: string): number {
  const value = Number(input)
  if (!Number.isFinite(value)) return 0
  return Math.min(MAX_RADIUS_KM, Math.max(0, Math.round(value)))
}
