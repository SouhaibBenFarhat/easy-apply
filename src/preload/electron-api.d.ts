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

export interface ModelStatus {
  state: ModelState
  modelId: string
  displayName: string
  totalBytes: number
  downloadedBytes: number
  error: string | null
  enabled: boolean
}

// Mirrors src/main/ipc/model.ts — the 'model:progress' push event.
export interface ModelProgressEvent {
  downloadedBytes: number
  totalBytes: number
  done: boolean
}

// Mirrors src/main/sync.ts — one line in the agent's live activity trace.
export interface AgentTraceEvent {
  seq: number
  at: string
  channel: 'sync' | 'mailbox' | 'llm'
  label: string
  body?: string
  chars?: number
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
    readonly onProgress: (callback: (event: ModelProgressEvent) => void) => () => void
  }
  readonly sync: {
    readonly now: () => Promise<IpcResult<SyncSummary>>
    readonly status: () => Promise<IpcResult<SyncStatus>>
    readonly onEvent: (callback: (event: SyncEvent) => void) => () => void
  }
  readonly agent: {
    readonly onTrace: (callback: (event: AgentTraceEvent) => void) => () => void
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
