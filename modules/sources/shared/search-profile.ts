import { z } from 'zod'

// The user's search intent — consumed by every provider (BA/Adzuna use
// keywords + city/radius; remote boards use remoteScopes). Defaults exist so
// PRs 6–9 code against real values before the Settings UI lands (PR 11).
// Zod schemas stay module-internal (isolatedDeclarations); consumers use the
// exported types + validate helpers.

export type RemoteScope = 'germany' | 'europe' | 'worldwide'
export const REMOTE_SCOPES: readonly RemoteScope[] = ['germany', 'europe', 'worldwide']

export interface SearchProfile {
  city: string
  radiusKm: number
  keywords: string[]
  remoteScopes: RemoteScope[]
}

const searchProfileSchema = z.object({
  city: z.string().min(1).max(80),
  radiusKm: z.number().int().min(0).max(200),
  keywords: z.array(z.string().min(1).max(60)).min(1).max(10),
  remoteScopes: z.array(z.enum(['germany', 'europe', 'worldwide'])).max(3),
}) satisfies z.ZodType<SearchProfile>

export const DEFAULT_SEARCH_PROFILE: SearchProfile = {
  city: 'München',
  radiusKm: 25,
  keywords: ['software'],
  remoteScopes: ['germany', 'europe', 'worldwide'],
}

export type ValidationResult<T> = { data: T } | { error: string }

export function validateSearchProfile(input: unknown): ValidationResult<SearchProfile> {
  const parsed = searchProfileSchema.safeParse(input)
  if (parsed.success) return { data: parsed.data }
  const issue = parsed.error.issues[0]
  return { error: `${issue?.path.join('.') ?? 'profile'}: ${issue?.message ?? 'invalid'}` }
}

// Merge a stored (possibly stale/partial) profile with defaults, dropping
// anything that no longer validates — schema drift must never crash the app.
export function resolveSearchProfile(stored: unknown): SearchProfile {
  const result = validateSearchProfile(stored)
  return 'data' in result ? result.data : DEFAULT_SEARCH_PROFILE
}
