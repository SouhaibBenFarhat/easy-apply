// L1 — renderer data layer. May import @sources/shared and @logger only
// (Biome-enforced); every side effect goes through window.electron, the
// typed preload bridge.

// Re-exported for feature convenience: consumers of @data shouldn't need a
// second import for the row/filter types its hooks traffic in.
export type {
  FeedFilters,
  JobSalary,
  JobStatus,
  NormalizedJob,
  RemoteScope,
  SalaryPeriod,
  SearchProfile,
  SourceId,
  StoredJob,
  WorkMode,
} from '@sources/shared'
export type {
  AppSettings,
  ProviderState,
  SourceInfo,
  SyncEvent,
  SyncRun,
  SyncStatus,
  SyncSummary,
} from '../../src/preload/electron-api'
export {
  createQueryClient,
  PERSIST_STORAGE_KEY,
  setupPersistence,
  shouldDehydrateQuery,
} from './client'
export { useSyncEventInvalidation, useSyncEvents } from './hooks/use-sync-events'
export { unwrap } from './ipc'
export { keys, type QueryKeys } from './keys'
export {
  type SetJobHiddenVariables,
  type SetJobNotesVariables,
  type SetJobStatusVariables,
  useSetJobHidden,
  useSetJobNotes,
  useSetJobStatus,
} from './mutations/jobs'
export { useMarkFeedVisited } from './mutations/local'
export { useSetAppSettings } from './mutations/settings'
export {
  type ClearSourceKeyVariables,
  type SetSourceEnabledVariables,
  type SetSourceKeyVariables,
  useClearSourceKey,
  useSetSourceEnabled,
  useSetSourceKey,
} from './mutations/sources'
export { useSyncNow } from './mutations/sync'
export { useSetTheme } from './mutations/theme'
export { useFeed, useJob } from './queries/jobs'
export { LAST_FEED_VISIT_STORAGE_KEY, useLastFeedVisit } from './queries/local'
export { useAppSettings } from './queries/settings'
export { useSources } from './queries/sources'
export { useSyncStatus } from './queries/sync'
export {
  applyThemeClasses,
  THEME_STORAGE_KEY,
  type ThemeVariant,
  useTheme,
} from './queries/theme'
