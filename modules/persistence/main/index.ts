// L1 (main-process half) — PGlite + Drizzle persistence. May import
// @sources/shared and @logger only; never @ui-kit/@data (Biome-enforced).

export { type AppDatabase, type CreateDatabaseOptions, createDatabase, type DrizzleDb } from './db'
export {
  type AgentRunStatus,
  type AgentRunStep,
  type AgentRunSummary,
  type AgentRunTrigger,
  type AppendAgentStepInput,
  appendAgentStep,
  type FinishAgentRunInput,
  finishAgentRun,
  getAgentRunSteps,
  listAgentRuns,
  pruneAgentRuns,
  reconcileStaleRuns,
  type StartAgentRunInput,
  startAgentRun,
} from './repositories/agent-runs'
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
export { agentRunSteps, agentRuns, jobs, providerState, syncRuns } from './schema'
