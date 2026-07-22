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

// Running counts for the email→job funnel, carried on 'pipeline' events so the
// monitor renders live progress. Mirrored in src/preload/electron-api.d.ts.
export interface AgentPipelineStats {
  emailsTotal: number // emails handed to the agent this run
  emailsProcessed: number // emails the agent has finished (progress)
  emailsAccepted: number // emails that yielded ≥1 kept job
  emailsRejected: number // emails that yielded no job
  jobsProposed: number // raw items the LLM returned, before the keep-harness
  jobsKept: number // items that survived the harness → reached the feed
  capped: boolean // true when the inbox exceeded the per-run scan cap
  done: boolean // the run has finished or been stopped (drives the Stop button)
  paused: boolean // the run is held mid-scan, waiting to resume
  // The email currently in flight (null between emails / when done). `url` is a
  // Gmail deep link to the message, or null when it can't be built.
  current: { subject: string; sender: string; url: string | null } | null
}

// A job the agent actually ingested from one email, small enough to ride along
// on a trace event. This is the audit trail: a count says "2 jobs", this says
// WHICH two, so a wrong extraction is visible instead of silently trusted.
// Mirrored in src/preload/electron-api.d.ts.
export interface AgentTraceJob {
  id: string
  title: string
  company: string
  url: string // the posting, opened externally through the window guards
}

// One line in the agent's live activity trace (surfaced in the header panel).
// seq/at are stamped by the broadcaster; callers supply the rest.
export interface AgentTraceInput {
  channel: 'sync' | 'mailbox' | 'llm' | 'pipeline' | 'thinking'
  label: string
  body?: string // the full prompt/response/reasoning text
  chars?: number // context load (prompt/response size)
  stats?: AgentPipelineStats // funnel counts, on 'pipeline' events
  jobs?: AgentTraceJob[] // what an email yielded, on its verdict event
}

export type TraceFn = (event: AgentTraceInput) => void

// Memory of which emails the mailbox agent has already scanned (by Message-ID),
// so each sync only runs the LLM on new mail. Backed by persistent storage in
// the main-process glue; absent means "scan everything" (e.g. in tests).
export interface ProcessedMessages {
  has(messageId: string): boolean
  add(messageId: string): void
}

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
  // Aborts a long provider run (email scan) between units of work — the user's
  // Stop button / turning AI off. Undefined when interruption isn't wired.
  signal?: AbortSignal
  // Cooperative pause: the provider checks isPaused() between units of work and,
  // when paused, awaits waitForResume() (which also resolves on Stop, so a
  // paused run can still be aborted). Undefined when pausing isn't wired.
  isPaused?: () => boolean
  waitForResume?: () => Promise<void>
  // Already-scanned email memory, so a sync only LLMs new mail.
  processedMessages?: ProcessedMessages
  // Persist a batch of jobs to the DB immediately, mid-fetch — provided by the
  // engine. Long runs (email scan) save each email's jobs as they go so a crash
  // (or dev restart) never loses work; the provider then marks that email
  // processed only AFTER its jobs are durable. Returns insert/update counts.
  saveJobs?: (jobs: NormalizedJob[]) => Promise<{ inserted: number; updated: number }>
}

export interface JobSourceProvider {
  meta: ProviderMeta
  fetch(ctx: FetchContext): Promise<RawPayload[]>
  parse(raw: RawPayload, ctx: FetchContext): NormalizedJob[]
}
