import type { Logger } from '@logger'
import type { NormalizedJob, SearchProfile, SourceId } from '@sources/shared'
import type { PoliteHttpClient } from './http'

// The provider plugin contract (PLAN.md §4.3). Each provider is one file in
// this directory: meta + fetch (raw pages/feeds, NO parsing decisions) +
// parse (zod at the boundary; throws → sync_run error, never crashes the app).

export interface ProviderMeta {
  id: SourceId
  displayName: string
  homepage: string
  enabledByDefault: boolean // keyless sources: true
  requiresKey?: { fields: ReadonlyArray<{ id: string; label: string; hint: string }> }
  attribution: { label: string; required: boolean } // "via RemoteOK ↗"
  politeness: { minIntervalMinutes: number; maxRequestsPerSync: number }
}

// One raw fetch result. `kind` lets parse() distinguish multi-endpoint fetches
// (e.g. BA search pages vs detail responses); `body` is raw text/JSON/RSS.
export interface RawPayload {
  kind: string
  body: string
}

export interface FetchContext {
  http: PoliteHttpClient
  config: Record<string, string> // decrypted keys (safeStorage)
  searchProfile: SearchProfile
  logger: Logger
}

export interface JobSourceProvider {
  meta: ProviderMeta
  fetch(ctx: FetchContext): Promise<RawPayload[]>
  parse(raw: RawPayload, ctx: FetchContext): NormalizedJob[]
}
