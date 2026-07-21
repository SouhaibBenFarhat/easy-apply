import type { FeedFilters, StoredJob } from '@sources/shared'
import { DEFAULT_SEARCH_PROFILE, isAgentSource } from '@sources/shared'
import type {
  AgentTraceEvent,
  AppSettings,
  ElectronAPI,
  ModelProgressEvent,
  ModelStatus,
  ProviderState,
  SourceInfo,
  SyncEvent,
} from '../../../src/preload/electron-api'

// Full window.electron mock surface. Grown alongside the real preload bridge
// so component tests never touch real IPC. The db namespace is a working
// in-memory fake (plain arrays, no PGlite) that mirrors the repository
// semantics: feed ordering, filters, preserved lifecycle fields; the sources
// namespace mirrors the sources:* IPC semantics (setKey enables the source);
// the sync namespace resolves quiet defaults, with push events driven from
// tests via createSyncEventEmitter (below).

export interface MockElectronSeed {
  jobs?: StoredJob[]
  providers?: ProviderState[]
  sources?: SourceInfo[]
  mailboxAccounts?: string[]
  modelStatus?: ModelStatus
}

const DEFAULT_MODEL_STATUS: ModelStatus = {
  state: 'absent',
  modelId: 'llama-3.1-8b-instruct-q4',
  displayName: 'Llama 3.1 8B Instruct (Q4)',
  totalBytes: 4_920_000_000,
  downloadedBytes: 0,
  error: null,
  enabled: true,
  reasoning: false,
  catalog: [
    {
      id: 'llama-3.1-8b-instruct-q4',
      displayName: 'Llama 3.1 8B Instruct (Q4)',
      sizeBytes: 4_920_000_000,
      reasoning: false,
      installed: false,
    },
    {
      id: 'deepseek-r1-distill-qwen-14b-q4',
      displayName: 'DeepSeek-R1 Distill 14B (Q4)',
      sizeBytes: 8_990_000_000,
      reasoning: true,
      installed: false,
    },
  ],
}

// Sensible defaults mirroring the real registry (same order): the five
// keyless sources enabled, Adzuna — the keyed source — disabled with no key.
const DEFAULT_SOURCES: readonly SourceInfo[] = [
  {
    sourceId: 'ba',
    displayName: 'Arbeitsagentur',
    homepage: 'https://www.arbeitsagentur.de/jobsuche/',
    enabledByDefault: true,
    enabled: true,
    lastSyncAt: null,
    hasKey: false,
    attribution: { label: 'Bundesagentur für Arbeit', required: false },
  },
  {
    sourceId: 'arbeitnow',
    displayName: 'Arbeitnow',
    homepage: 'https://www.arbeitnow.com',
    enabledByDefault: true,
    enabled: true,
    lastSyncAt: null,
    hasKey: false,
    attribution: { label: 'arbeitnow.com', required: false },
  },
  {
    sourceId: 'himalayas',
    displayName: 'Himalayas',
    homepage: 'https://himalayas.app',
    enabledByDefault: true,
    enabled: true,
    lastSyncAt: null,
    hasKey: false,
    attribution: { label: 'Himalayas', required: true },
  },
  {
    sourceId: 'remoteok',
    displayName: 'RemoteOK',
    homepage: 'https://remoteok.com',
    enabledByDefault: true,
    enabled: true,
    lastSyncAt: null,
    hasKey: false,
    attribution: { label: 'Remote OK', required: true },
  },
  {
    sourceId: 'wwr',
    displayName: 'WeWorkRemotely',
    homepage: 'https://weworkremotely.com',
    enabledByDefault: true,
    enabled: true,
    lastSyncAt: null,
    hasKey: false,
    attribution: { label: 'We Work Remotely', required: false },
  },
  {
    sourceId: 'adzuna',
    displayName: 'Adzuna',
    homepage: 'https://www.adzuna.de',
    enabledByDefault: false,
    enabled: false,
    lastSyncAt: null,
    hasKey: false,
    requiresKey: {
      fields: [
        { id: 'app_id', label: 'Application ID', hint: 'from developer.adzuna.com' },
        { id: 'app_key', label: 'Application key', hint: 'from developer.adzuna.com' },
      ],
    },
    attribution: { label: 'Jobs by Adzuna', required: true },
  },
  {
    sourceId: 'mailbox',
    displayName: 'Job-alert inbox',
    homepage: 'https://mail.google.com',
    enabledByDefault: false,
    enabled: false,
    lastSyncAt: null,
    hasKey: false,
    requiresKey: {
      fields: [
        { id: 'email', label: 'Gmail address', hint: 'you@gmail.com', secret: false },
        { id: 'app_password', label: 'App password', hint: 'paste the 16-character code' },
      ],
    },
    attribution: { label: 'Your inbox', required: false },
  },
]

function feedOrder(a: StoredJob, b: StoredJob): number {
  // posted_at desc nulls last, then first_seen_at desc — same as listFeed.
  if (a.postedAt !== b.postedAt) {
    if (a.postedAt === null) return 1
    if (b.postedAt === null) return -1
    return a.postedAt < b.postedAt ? 1 : -1
  }
  return a.firstSeenAt < b.firstSeenAt ? 1 : a.firstSeenAt > b.firstSeenAt ? -1 : 0
}

function applyFeedFilters(rows: StoredJob[], filters: FeedFilters): StoredJob[] {
  let out = rows.filter((job) => {
    if (filters.workModes && !filters.workModes.includes(job.workMode)) return false
    if (
      filters.remoteScopes &&
      (job.remoteScope === null || !filters.remoteScopes.includes(job.remoteScope))
    )
      return false
    if (filters.sources && !filters.sources.includes(job.sourceId)) return false
    if (filters.origin === 'agent' && !isAgentSource(job.sourceId)) return false
    if (filters.origin === 'api' && isAgentSource(job.sourceId)) return false
    if (filters.hasSalary === true && job.salary.min === null && job.salary.max === null)
      return false
    if (filters.search !== undefined && filters.search.trim() !== '') {
      const needle = filters.search.trim().toLowerCase()
      if (!job.title.toLowerCase().includes(needle) && !job.company.toLowerCase().includes(needle))
        return false
    }
    if (filters.status !== undefined) {
      if (filters.status === 'none' ? job.status !== null : job.status !== filters.status)
        return false
    }
    if (filters.includeHidden !== true && job.hidden) return false
    return true
  })
  out = out.toSorted(feedOrder)
  const offset = filters.offset ?? 0
  return out.slice(offset, offset + (filters.limit ?? 200))
}

// sync.onEvent subscribers, keyed by the mock's sync namespace object (not
// the whole API) so the pairing survives setupMockElectron's spread
// ({ ...createMockElectron(), ...overrides }).
const syncListenersByNamespace = new WeakMap<ElectronAPI['sync'], Set<(event: SyncEvent) => void>>()

// Pairs with createMockElectron/setupMockElectron: returns an emit function
// that delivers a SyncEvent to everything the mock's sync.onEvent registered —
// the test-side stand-in for webContents.send('sync:event', …). Kept as a
// separate helper so the mock surface stays identical to ElectronAPI.
export function createSyncEventEmitter(mock: ElectronAPI): (event: SyncEvent) => void {
  return (event: SyncEvent): void => {
    const listeners = syncListenersByNamespace.get(mock.sync)
    if (listeners === undefined) return
    for (const listener of [...listeners]) listener(event)
  }
}

// agent.onTrace subscribers, keyed like the emitters above.
const traceListenersByNamespace = new WeakMap<
  ElectronAPI['agent'],
  Set<(event: AgentTraceEvent) => void>
>()

// Drives the mock's agent.onTrace subscribers — the stand-in for
// webContents.send('agent:trace', …).
export function createAgentTraceEmitter(mock: ElectronAPI): (event: AgentTraceEvent) => void {
  return (event: AgentTraceEvent): void => {
    const listeners = traceListenersByNamespace.get(mock.agent)
    if (listeners === undefined) return
    for (const listener of [...listeners]) listener(event)
  }
}

// model.onProgress subscribers, keyed like the sync emitter above.
const modelListenersByNamespace = new WeakMap<
  ElectronAPI['model'],
  Set<(event: ModelProgressEvent) => void>
>()

// Pairs with the mock: delivers a ModelProgressEvent to everything the mock's
// model.onProgress registered — the test-side stand-in for
// webContents.send('model:progress', …).
export function createModelProgressEmitter(mock: ElectronAPI): (event: ModelProgressEvent) => void {
  return (event: ModelProgressEvent): void => {
    const listeners = modelListenersByNamespace.get(mock.model)
    if (listeners === undefined) return
    for (const listener of [...listeners]) listener(event)
  }
}

export function createMockElectron(seed: MockElectronSeed = {}): ElectronAPI {
  const settings: AppSettings = {
    searchProfile: DEFAULT_SEARCH_PROFILE,
    syncIntervalHours: 3,
  }
  const jobs: StoredJob[] = (seed.jobs ?? []).map((job) => ({ ...job }))
  const providers: ProviderState[] = (seed.providers ?? []).map((state) => ({ ...state }))
  const sources = new Map<string, SourceInfo>(
    (seed.sources ?? DEFAULT_SOURCES).map((info) => [info.sourceId, { ...info }]),
  )
  // Emails only — the mock, like the real bridge, never holds app passwords.
  const mailboxAccounts: string[] = [...(seed.mailboxAccounts ?? [])]

  const findJob = (id: string): StoredJob | undefined => jobs.find((job) => job.id === id)

  let modelStatus: ModelStatus = { ...(seed.modelStatus ?? DEFAULT_MODEL_STATUS) }
  const modelListeners = new Set<(event: ModelProgressEvent) => void>()
  const model: ElectronAPI['model'] = {
    status: async () => ({ success: true, data: { ...modelStatus } }),
    download: async () => {
      modelStatus = { ...modelStatus, state: 'downloading', downloadedBytes: 0, error: null }
      return { success: true, data: { ...modelStatus } }
    },
    cancel: async () => {
      modelStatus = { ...modelStatus, state: 'absent', downloadedBytes: 0 }
      return { success: true, data: { ...modelStatus } }
    },
    remove: async () => {
      modelStatus = { ...modelStatus, state: 'absent', downloadedBytes: 0, error: null }
      return { success: true, data: { ...modelStatus } }
    },
    setEnabled: async (enabled) => {
      modelStatus = { ...modelStatus, enabled }
      return { success: true, data: { ...modelStatus } }
    },
    select: async (modelId) => {
      const choice = modelStatus.catalog.find((entry) => entry.id === modelId)
      if (choice === undefined) return { success: false, error: `unknown model ${modelId}` }
      modelStatus = {
        ...modelStatus,
        modelId: choice.id,
        displayName: choice.displayName,
        totalBytes: choice.sizeBytes,
        reasoning: choice.reasoning,
        state: choice.installed ? 'ready' : 'absent',
        downloadedBytes: choice.installed ? choice.sizeBytes : 0,
        error: null,
      }
      return { success: true, data: { ...modelStatus } }
    },
    onProgress: (callback) => {
      modelListeners.add(callback)
      return () => {
        modelListeners.delete(callback)
      }
    },
  }
  modelListenersByNamespace.set(model, modelListeners)

  const syncListeners = new Set<(event: SyncEvent) => void>()
  const sync: ElectronAPI['sync'] = {
    now: async () => {
      const nowIso = new Date().toISOString()
      return {
        success: true,
        data: { inserted: 0, updated: 0, perSource: [], startedAt: nowIso, finishedAt: nowIso },
      }
    },
    status: async () => ({
      success: true,
      data: { running: false, lastCompletedAt: null, recentRuns: [] },
    }),
    onEvent: (callback) => {
      syncListeners.add(callback)
      return () => {
        syncListeners.delete(callback)
      }
    },
  }
  syncListenersByNamespace.set(sync, syncListeners)

  const traceListeners = new Set<(event: AgentTraceEvent) => void>()
  const agent: ElectronAPI['agent'] = {
    onTrace: (callback) => {
      traceListeners.add(callback)
      return () => {
        traceListeners.delete(callback)
      }
    },
    stop: async () => ({ success: true, data: false }),
    pause: async () => ({ success: true, data: false }),
    resume: async () => ({ success: true, data: false }),
  }
  traceListenersByNamespace.set(agent, traceListeners)

  return {
    platform: 'darwin',
    settings: {
      get: async () => ({ success: true, data: settings }),
      set: async (update) => ({ success: true, data: { ...settings, ...update } }),
    },
    db: {
      jobs: {
        list: async (filters = {}) => ({ success: true, data: applyFeedFilters(jobs, filters) }),
        get: async (id) => ({ success: true, data: findJob(id) ?? null }),
        setStatus: async (id, status) => {
          const job = findJob(id)
          if (job === undefined) return { success: true, data: null }
          job.status = status
          job.statusUpdatedAt = new Date().toISOString()
          return { success: true, data: { ...job } }
        },
        setNotes: async (id, notes) => {
          const job = findJob(id)
          if (job === undefined) return { success: true, data: null }
          job.notes = notes
          return { success: true, data: { ...job } }
        },
        setHidden: async (id, hidden) => {
          const job = findJob(id)
          if (job === undefined) return { success: true, data: null }
          job.hidden = hidden
          return { success: true, data: { ...job } }
        },
      },
      providers: {
        list: async () => ({ success: true, data: providers.map((state) => ({ ...state })) }),
        setEnabled: async (sourceId, enabled) => {
          let state = providers.find((entry) => entry.sourceId === sourceId)
          if (state === undefined) {
            state = { sourceId, enabled, lastSyncAt: null, configJson: null }
            providers.push(state)
          } else {
            state.enabled = enabled
          }
          return { success: true, data: { ...state } }
        },
      },
    },
    sources: {
      list: async () => ({
        success: true,
        data: [...sources.values()].map((info) => ({ ...info })),
      }),
      setEnabled: async (sourceId, enabled) => {
        const info = sources.get(sourceId)
        if (info === undefined) return { success: false, error: `unknown source ${sourceId}` }
        info.enabled = enabled
        return { success: true, data: { ...info } }
      },
      setKey: async (sourceId, _values) => {
        const info = sources.get(sourceId)
        if (info === undefined) return { success: false, error: `unknown source ${sourceId}` }
        if (info.requiresKey === undefined)
          return { success: false, error: `${sourceId} does not take an API key` }
        info.hasKey = true
        info.enabled = true // setting a key implies intent to use — mirrors main
        return { success: true, data: { ...info } }
      },
      clearKey: async (sourceId) => {
        const info = sources.get(sourceId)
        if (info === undefined) return { success: false, error: `unknown source ${sourceId}` }
        info.hasKey = false
        return { success: true, data: { ...info } }
      },
    },
    mailbox: {
      list: async () => ({ success: true, data: mailboxAccounts.map((email) => ({ email })) }),
      add: async (email, _appPassword) => {
        const trimmed = email.trim()
        if (!mailboxAccounts.some((entry) => entry.toLowerCase() === trimmed.toLowerCase()))
          mailboxAccounts.push(trimmed)
        // Mirror main: connecting an inbox enables the mailbox source.
        const info = sources.get('mailbox')
        if (info !== undefined) {
          info.hasKey = true
          info.enabled = true
        }
        return { success: true, data: mailboxAccounts.map((email) => ({ email })) }
      },
      remove: async (email) => {
        const key = email.trim().toLowerCase()
        const index = mailboxAccounts.findIndex((entry) => entry.toLowerCase() === key)
        if (index >= 0) mailboxAccounts.splice(index, 1)
        return { success: true, data: mailboxAccounts.map((email) => ({ email })) }
      },
    },
    model,
    sync,
    agent,
  }
}

export function setupMockElectron(overrides: Partial<ElectronAPI> = {}): ElectronAPI {
  const mock = { ...createMockElectron(), ...overrides }
  Object.defineProperty(window, 'electron', { value: mock, writable: true, configurable: true })
  return mock
}
