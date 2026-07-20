// L1 (main-process half) — PGlite + Drizzle persistence. May import
// @sources/shared and @logger only; never @ui-kit/@data (Biome-enforced).

export { type AppDatabase, type CreateDatabaseOptions, createDatabase, type DrizzleDb } from './db'
export {
  getJob,
  listFeed,
  setJobHidden,
  setJobNotes,
  setJobStatus,
  upsertJobs,
} from './repositories/jobs'
export {
  getProviderStates,
  type ProviderState,
  type ProviderStatePatch,
  setProviderEnabled,
  upsertProviderState,
} from './repositories/provider-state'
export {
  finishSyncRun,
  listRecentSyncRuns,
  type SyncRun,
  type SyncRunResult,
  startSyncRun,
} from './repositories/sync-runs'
export { jobs, providerState, syncRuns } from './schema'
