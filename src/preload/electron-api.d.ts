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
  requiresKey?: { fields: ReadonlyArray<{ id: string; label: string; hint: string }> }
  attribution: { label: string; required: boolean }
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
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
