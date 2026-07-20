import type { AppDatabase, ProviderState } from '@persistence/main'
import {
  getJob,
  getProviderStates,
  listFeed,
  setJobHidden,
  setJobNotes,
  setJobStatus,
  setProviderEnabled,
} from '@persistence/main'
import type { FeedFilters, IpcResult, JobStatus, SourceId, StoredJob } from '@sources/shared'
import { fail, JOB_STATUSES, ok, REMOTE_SCOPES, SOURCE_IDS, WORK_MODES } from '@sources/shared'
import { ipcMain } from 'electron'

// db:* channels — thin validation + delegation to @persistence/main
// repositories. Same conventions as settings.ts: every handler resolves to an
// IpcResult; errors are values, never thrown across the bridge.

function pickMembers<T extends string>(value: unknown, allowed: readonly T[]): T[] | undefined {
  if (!Array.isArray(value)) return undefined
  const picked = value.filter((item): item is T => allowed.includes(item as T))
  return picked.length > 0 ? picked : undefined
}

// Loose validation: keep what parses, drop what doesn't — a stale/garbage
// filter shape must degrade to "unfiltered", never to an error.
function sanitizeFilters(input: unknown): FeedFilters {
  if (typeof input !== 'object' || input === null) return {}
  const raw = input as Record<string, unknown>
  const filters: FeedFilters = {}

  const workModes = pickMembers(raw.workModes, WORK_MODES)
  if (workModes) filters.workModes = workModes
  const remoteScopes = pickMembers(raw.remoteScopes, REMOTE_SCOPES)
  if (remoteScopes) filters.remoteScopes = remoteScopes
  const sources = pickMembers(raw.sources, SOURCE_IDS)
  if (sources) filters.sources = sources
  if (typeof raw.hasSalary === 'boolean') filters.hasSalary = raw.hasSalary
  if (typeof raw.search === 'string') filters.search = raw.search
  if (raw.status === 'none') filters.status = 'none'
  else if (
    typeof raw.status === 'string' &&
    (JOB_STATUSES as readonly string[]).includes(raw.status)
  )
    filters.status = raw.status as JobStatus
  if (typeof raw.includeHidden === 'boolean') filters.includeHidden = raw.includeHidden
  if (typeof raw.limit === 'number' && Number.isFinite(raw.limit))
    filters.limit = Math.min(Math.max(Math.trunc(raw.limit), 1), 1000)
  if (typeof raw.offset === 'number' && Number.isFinite(raw.offset))
    filters.offset = Math.max(Math.trunc(raw.offset), 0)
  return filters
}

function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === 'string' && (JOB_STATUSES as readonly string[]).includes(value)
}

function isSourceId(value: unknown): value is SourceId {
  return typeof value === 'string' && (SOURCE_IDS as readonly string[]).includes(value)
}

export function registerDbIpc(db: AppDatabase): void {
  ipcMain.handle(
    'db:jobs:list',
    async (_event, filters: unknown): Promise<IpcResult<StoredJob[]>> => {
      try {
        return ok(await listFeed(db, sanitizeFilters(filters)))
      } catch (error) {
        return fail(error)
      }
    },
  )

  ipcMain.handle(
    'db:jobs:get',
    async (_event, id: unknown): Promise<IpcResult<StoredJob | null>> => {
      try {
        if (typeof id !== 'string') return fail('id must be a string')
        return ok(await getJob(db, id))
      } catch (error) {
        return fail(error)
      }
    },
  )

  ipcMain.handle(
    'db:jobs:set-status',
    async (_event, id: unknown, status: unknown): Promise<IpcResult<StoredJob | null>> => {
      try {
        if (typeof id !== 'string') return fail('id must be a string')
        if (status !== null && !isJobStatus(status))
          return fail(`status must be null or one of: ${JOB_STATUSES.join(', ')}`)
        return ok(await setJobStatus(db, id, status))
      } catch (error) {
        return fail(error)
      }
    },
  )

  ipcMain.handle(
    'db:jobs:set-notes',
    async (_event, id: unknown, notes: unknown): Promise<IpcResult<StoredJob | null>> => {
      try {
        if (typeof id !== 'string') return fail('id must be a string')
        if (notes !== null && typeof notes !== 'string')
          return fail('notes must be a string or null')
        return ok(await setJobNotes(db, id, notes))
      } catch (error) {
        return fail(error)
      }
    },
  )

  ipcMain.handle(
    'db:jobs:set-hidden',
    async (_event, id: unknown, hidden: unknown): Promise<IpcResult<StoredJob | null>> => {
      try {
        if (typeof id !== 'string') return fail('id must be a string')
        if (typeof hidden !== 'boolean') return fail('hidden must be a boolean')
        return ok(await setJobHidden(db, id, hidden))
      } catch (error) {
        return fail(error)
      }
    },
  )

  ipcMain.handle('db:providers:list', async (): Promise<IpcResult<ProviderState[]>> => {
    try {
      return ok(await getProviderStates(db))
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(
    'db:providers:set-enabled',
    async (_event, sourceId: unknown, enabled: unknown): Promise<IpcResult<ProviderState>> => {
      try {
        if (!isSourceId(sourceId)) return fail(`sourceId must be one of: ${SOURCE_IDS.join(', ')}`)
        if (typeof enabled !== 'boolean') return fail('enabled must be a boolean')
        return ok(await setProviderEnabled(db, sourceId, enabled))
      } catch (error) {
        return fail(error)
      }
    },
  )
}
