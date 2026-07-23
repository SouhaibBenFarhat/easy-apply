export { describeError } from './errors'
export { fail, type IpcResult, ok } from './ipc'
export {
  type FeedFilters,
  isAgentSource,
  JOB_STATUSES,
  type JobOrigin,
  type JobSalary,
  type JobStatus,
  MAILBOX_SOURCE_IDS,
  type NormalizedJob,
  type SalaryPeriod,
  SOURCE_IDS,
  type SourceId,
  type StoredJob,
  WORK_MODES,
  type WorkMode,
} from './job'
export {
  DEFAULT_SEARCH_PROFILE,
  REMOTE_SCOPES,
  type RemoteScope,
  resolveSearchProfile,
  type SearchProfile,
  type ValidationResult,
  validateSearchProfile,
} from './search-profile'
