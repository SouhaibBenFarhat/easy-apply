import type { Logger } from '@logger'
import type { NormalizedJob, SearchProfile, SourceId } from '@sources/shared'
import type { PoliteHttpClient } from './http'
import type { MailAccount, MailDriver } from './mail'
import type { LlmClient } from './mail-extract'

// The provider plugin contract (PLAN.md §4.3). Each provider is one file in
// this directory: meta + fetch (raw pages/feeds, NO parsing decisions) +
// parse (zod at the boundary; throws → sync_run error, never crashes the app).

export interface ProviderMeta {
  id: SourceId
  displayName: string
  homepage: string
  enabledByDefault: boolean // keyless sources: true
  requiresKey?: {
    fields: ReadonlyArray<{ id: string; label: string; hint: string; secret?: boolean }>
  }
  attribution: { label: string; required: boolean } // "via RemoteOK ↗"
  politeness: { minIntervalMinutes: number; maxRequestsPerSync: number }
}

// One raw fetch result. `kind` lets parse() distinguish multi-endpoint fetches
// (e.g. BA search pages vs detail responses); `body` is raw text/JSON/RSS.
export interface RawPayload {
  kind: string
  body: string
}

// One line in the agent's live activity trace (surfaced in the header panel).
// seq/at are stamped by the broadcaster; callers supply the rest.
export interface AgentTraceInput {
  channel: 'sync' | 'mailbox' | 'llm'
  label: string
  body?: string // the full prompt or response text, for llm lines
  chars?: number // context load (prompt/response size)
}

export type TraceFn = (event: AgentTraceInput) => void

export interface FetchContext {
  http: PoliteHttpClient
  config: Record<string, string> // decrypted keys (safeStorage)
  searchProfile: SearchProfile
  logger: Logger
  // Provided only for the mailbox source (email ingestion): a factory that
  // opens an IMAP connection for one account, and the on-device LLM. Undefined
  // when the runtime isn't available (e.g. the model isn't installed) — the
  // provider then skips quietly.
  createMail?: (account: MailAccount) => MailDriver
  llm?: LlmClient
  // Live activity trace for the header monitor (no-op when not wired).
  trace?: TraceFn
}

export interface JobSourceProvider {
  meta: ProviderMeta
  fetch(ctx: FetchContext): Promise<RawPayload[]>
  parse(raw: RawPayload, ctx: FetchContext): NormalizedJob[]
}
