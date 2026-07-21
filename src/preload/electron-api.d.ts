// Hand-maintained contract between preload (implementation) and renderer
// (consumer). Every channel added in src/preload/index.ts must be declared
// here; the renderer only ever touches `window.electron`.
import type {
  FeedFilters,
  IpcResult,
  JobStatus,
  SearchProfile,
  SourceId,
  StoredJob,
} from '../../modules/sources/shared'

export interface AppSettings {
  searchProfile: SearchProfile
  syncIntervalHours: number
}

// Mirrors modules/persistence/main/repositories/provider-state.ts — duplicated
// here because renderer-side compilation units never include main-process code.
export interface ProviderState {
  sourceId: SourceId
  enabled: boolean
  lastSyncAt: string | null
  configJson: string | null
}

// Mirrors src/main/ipc/sources.ts — the exact 'sources:list' row shape.
// hasKey is deliberately a boolean: decrypted key material never crosses the
// bridge back to the renderer.
export interface SourceInfo {
  sourceId: SourceId
  displayName: string
  homepage: string
  enabledByDefault: boolean
  enabled: boolean
  lastSyncAt: string | null
  hasKey: boolean
  requiresKey?: {
    fields: ReadonlyArray<{ id: string; label: string; hint: string; secret?: boolean }>
  }
  attribution: { label: string; required: boolean }
}

// Mirrors modules/sources/main/engine.ts — the sync engine's push events and
// pass summary, duplicated here because renderer-side compilation units never
// include main-process code.
export type SyncEvent =
  | { type: 'sync:started'; startedAt: string }
  | { type: 'source:started'; sourceId: SourceId }
  | {
      type: 'source:finished'
      sourceId: SourceId
      ok: boolean
      inserted: number
      updated: number
      error: string | null
    }
  | {
      type: 'sync:completed'
      inserted: number
      updated: number
      failed: SourceId[]
      finishedAt: string
    }

export interface SyncSummary {
  inserted: number
  updated: number
  perSource: Array<{
    sourceId: SourceId
    ok: boolean
    inserted: number
    updated: number
    error: string | null
    skipped: boolean
  }>
  startedAt: string
  finishedAt: string
}

// Mirrors src/main/ipc/mailbox.ts — one connected mail account. Only the
// address crosses the bridge; the App Password never leaves the main process.
export interface MailboxAccountInfo {
  email: string
}

// Mirrors src/main/model.ts — the local-LLM model state.
export type ModelState = 'absent' | 'downloading' | 'ready' | 'error'

// One selectable model in the picker.
export interface ModelChoice {
  id: string
  displayName: string
  sizeBytes: number
  reasoning: boolean
  installed: boolean
}

export interface ModelStatus {
  state: ModelState
  modelId: string // the selected model
  displayName: string
  totalBytes: number
  downloadedBytes: number
  error: string | null
  enabled: boolean
  reasoning: boolean // the selected model is a reasoning model
  catalog: ModelChoice[] // every downloadable model + its installed state
}

// Mirrors src/main/ipc/model.ts — the 'model:progress' push event.
export interface ModelProgressEvent {
  downloadedBytes: number
  totalBytes: number
  done: boolean
}

// Running counts for the email→job funnel, carried on 'pipeline' trace events
// so the monitor can render live progress. Mirrors modules/sources/main/types.ts.
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

// Mirrors src/main/sync.ts — one line in the agent's live activity trace.
export interface AgentTraceEvent {
  seq: number
  at: string
  channel: 'sync' | 'mailbox' | 'llm' | 'pipeline' | 'thinking'
  label: string
  body?: string
  chars?: number
  stats?: AgentPipelineStats
}

// Mirrors modules/persistence/main/repositories/sync-runs.ts.
export interface SyncRun {
  id: number
  sourceId: SourceId
  startedAt: string
  finishedAt: string | null
  ok: boolean | null
  error: string | null
  inserted: number
  updated: number
}

// Mirrors src/main/sync.ts — the exact 'sync:status' payload.
export interface SyncStatus {
  running: boolean
  lastCompletedAt: string | null
  recentRuns: SyncRun[]
}

export interface ElectronAPI {
  readonly platform: NodeJS.Platform
  readonly settings: {
    readonly get: () => Promise<IpcResult<AppSettings>>
    readonly set: (update: Partial<AppSettings>) => Promise<IpcResult<AppSettings>>
  }
  readonly db: {
    readonly jobs: {
      readonly list: (filters?: FeedFilters) => Promise<IpcResult<StoredJob[]>>
      readonly get: (id: string) => Promise<IpcResult<StoredJob | null>>
      readonly setStatus: (
        id: string,
        status: JobStatus | null,
      ) => Promise<IpcResult<StoredJob | null>>
      readonly setNotes: (id: string, notes: string | null) => Promise<IpcResult<StoredJob | null>>
      readonly setHidden: (id: string, hidden: boolean) => Promise<IpcResult<StoredJob | null>>
    }
    readonly providers: {
      readonly list: () => Promise<IpcResult<ProviderState[]>>
      readonly setEnabled: (
        sourceId: SourceId,
        enabled: boolean,
      ) => Promise<IpcResult<ProviderState>>
    }
  }
  readonly sources: {
    readonly list: () => Promise<IpcResult<SourceInfo[]>>
    readonly setEnabled: (sourceId: SourceId, enabled: boolean) => Promise<IpcResult<SourceInfo>>
    readonly setKey: (
      sourceId: SourceId,
      values: Record<string, string>,
    ) => Promise<IpcResult<SourceInfo>>
    readonly clearKey: (sourceId: SourceId) => Promise<IpcResult<SourceInfo>>
  }
  readonly mailbox: {
    readonly list: () => Promise<IpcResult<MailboxAccountInfo[]>>
    readonly add: (email: string, appPassword: string) => Promise<IpcResult<MailboxAccountInfo[]>>
    readonly remove: (email: string) => Promise<IpcResult<MailboxAccountInfo[]>>
  }
  readonly model: {
    readonly status: () => Promise<IpcResult<ModelStatus>>
    readonly download: () => Promise<IpcResult<ModelStatus>>
    readonly cancel: () => Promise<IpcResult<ModelStatus>>
    readonly remove: () => Promise<IpcResult<ModelStatus>>
    readonly setEnabled: (enabled: boolean) => Promise<IpcResult<ModelStatus>>
    readonly select: (modelId: string) => Promise<IpcResult<ModelStatus>>
    readonly onProgress: (callback: (event: ModelProgressEvent) => void) => () => void
  }
  readonly sync: {
    readonly now: () => Promise<IpcResult<SyncSummary>>
    readonly status: () => Promise<IpcResult<SyncStatus>>
    readonly onEvent: (callback: (event: SyncEvent) => void) => () => void
  }
  readonly agent: {
    readonly onTrace: (callback: (event: AgentTraceEvent) => void) => () => void
    // Interrupt the running pass; resolves true if a run was actually aborted.
    readonly stop: () => Promise<IpcResult<boolean>>
    // Hold / resume the running scan between emails.
    readonly pause: () => Promise<IpcResult<boolean>>
    readonly resume: () => Promise<IpcResult<boolean>>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
