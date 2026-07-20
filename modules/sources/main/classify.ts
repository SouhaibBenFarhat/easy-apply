import type { RemoteScope, WorkMode } from '@sources/shared'

// Pure work-mode / remote-scope classification (PLAN.md §4.4). Providers with
// authoritative flags decide before calling in: Arbeitnow passes its `remote`
// bool as explicitRemote; BA maps `homeofficemoeglich ? 'hybrid' : 'onsite'`
// at the provider level and never reaches the heuristic.

export interface ClassificationInput {
  title: string
  description: string | null
  locationRaw: string
  explicitRemote?: boolean | null
  candidateLocation?: string | null
}

const HYBRID_RE = /\bhybrid\b/i
const REMOTE_RE = /\b(?:fully remote|100% remote|remote-first|homeoffice|home office|remote)\b/i
const ONSITE_RE = /\b(?:on-?site|vor ort)\b/i

const GERMANY_RE = /\b(?:germany|deutschland|dach)\b/i
const EUROPE_RE = /\b(?:europe|emea|eu)\b/i
const WORLDWIDE_RE = /\b(?:worldwide|anywhere|global)\b/i

export function classifyWorkMode(input: ClassificationInput): WorkMode {
  if (input.explicitRemote === true) return 'remote'
  const location = input.locationRaw.trim()
  if (input.explicitRemote === false && location !== '') return 'onsite'
  // Heuristic over title + description + location. Hybrid beats remote:
  // "hybrid, 2 days remote" is a hybrid role.
  const haystack = `${input.title} ${input.description ?? ''} ${location}`
  if (HYBRID_RE.test(haystack)) return 'hybrid'
  if (REMOTE_RE.test(haystack)) return 'remote'
  if (ONSITE_RE.test(haystack)) return 'onsite'
  return 'unknown'
}

// Maps candidate_required_location / locationRestrictions / <region> style
// fields (Remotive, Himalayas, WWR) onto our scope buckets. Word-bounded so
// 'Deutschland' never matches \beu\b and 'Dachau' never matches \bdach\b.
// Unmappable regions ('USA', US-state lists) → null.
export function classifyRemoteScope(candidateLocation: string | null): RemoteScope | null {
  if (candidateLocation === null) return null
  if (GERMANY_RE.test(candidateLocation)) return 'germany'
  if (EUROPE_RE.test(candidateLocation)) return 'europe'
  if (WORLDWIDE_RE.test(candidateLocation)) return 'worldwide'
  return null
}
