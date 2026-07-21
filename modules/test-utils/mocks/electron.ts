import type { FeedFilters, StoredJob } from '@sources/shared'
import { DEFAULT_SEARCH_PROFILE } from '@sources/shared'
import type {
  AppSettings,
  ElectronAPI,
  ProviderState,
  SourceInfo,
} from '../../../src/preload/electron-api'

// Full window.electron mock surface. Grown alongside the real preload bridge
// so component tests never touch real IPC. The db namespace is a working
// in-memory fake (plain arrays, no PGlite) that mirrors the repository
// semantics: feed ordering, filters, preserved lifecycle fields; the sources
// namespace mirrors the sources:* IPC semantics (setKey enables the source).

export interface MockElectronSeed {
  jobs?: StoredJob[]
  providers?: ProviderState[]
  sources?: SourceInfo[]
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

  const findJob = (id: string): StoredJob | undefined => jobs.find((job) => job.id === id)

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
  }
}

export function setupMockElectron(overrides: Partial<ElectronAPI> = {}): ElectronAPI {
  const mock = { ...createMockElectron(), ...overrides }
  Object.defineProperty(window, 'electron', { value: mock, writable: true, configurable: true })
  return mock
}
