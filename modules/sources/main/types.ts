import type { Logger } from '@logger'
import type { MailScanConfig, NormalizedJob, SearchProfile, SourceId } from '@sources/shared'
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

// Which stage of the run the agent is in. The funnel needs this because only
// `scanning` has a known total: reading the inbox, triaging and downloading
// finish when they finish, and a bar frozen at 0/200 through all three reads as
// a hung app. Mirrored in src/preload/electron-api.d.ts.
export type AgentPhase = 'reading' | 'triaging' | 'downloading' | 'scanning' | 'done'

// Running counts for the email→job funnel, carried on 'pipeline' events so the
// monitor renders live progress. Mirrored in src/preload/electron-api.d.ts.
export interface AgentPipelineStats {
  phase: AgentPhase
  // Progress WITHIN the current phase, in that phase's own unit: inboxes read,
  // triage chunks judged, inboxes downloaded. `scanning` ignores these and uses
  // emailsProcessed/emailsTotal instead — it is the row-based phase.
  // phaseTotal 0 means the total is genuinely unknowable yet (only true for the
  // first moment of a phase), which is the sole case that may show an
  // indeterminate bar.
  phaseDone: number
  phaseTotal: number
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
  location: string | null // city, or the raw place; null when unknown
  source: string // the board it came from, display-cased (LinkedIn, Inbox, …)
  url: string // the posting, opened externally through the window guards
}

// The outcome of a step, STATED by the code that emits it — never guessed from
// the label. 'in-progress' is a render-only state (the newest row while the
// agent is running); emitters only ever state a settled outcome, defaulting to
// 'done'. Mirrored in src/preload/electron-api.d.ts.
export type TraceStatus = 'done' | 'failed' | 'skipped'

// One line in the agent's live activity trace (surfaced in the header panel).
// seq/at are stamped by the broadcaster; callers supply the rest.
export interface AgentTraceInput {
  channel: 'sync' | 'mailbox' | 'llm' | 'pipeline' | 'thinking'
  label: string
  // Step outcome. Omitted means 'done' — only failures and skips say so.
  status?: TraceStatus
  body?: string // the full prompt/response/reasoning text
  chars?: number // context load (prompt/response size)
  stats?: AgentPipelineStats // funnel counts, on 'pipeline' events
  jobs?: AgentTraceJob[] // what an email yielded, on its verdict event
  // Wall-clock ms from the step's start to this completion checkpoint,
  // measured where the work runs (main) — the renderer never derives timing.
  durationMs?: number
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
  // The user's first-sweep filters (enabled domains + subject keywords, and the
  // disabled domains that hard-exclude). Provided for the mailbox source.
  mailScan?: MailScanConfig
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
