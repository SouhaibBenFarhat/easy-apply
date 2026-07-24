import { and, asc, desc, eq, lt, sql } from 'drizzle-orm'
import type { AppDatabase } from '../db'
import { type AgentRunStatus, type AgentRunTrigger, agentRunSteps, agentRuns } from '../schema'

// Durable agent-run history: one run row per pass, many step rows per run. The
// live trace is still an in-memory push (src/main/sync.ts); this persists it so
// the Runs page can show past runs and re-open their timelines. Row↔model
// mapping and the retention prune live here.

export type { AgentRunStatus, AgentRunTrigger } from '../schema'

type RunRow = typeof agentRuns.$inferSelect
type StepRow = typeof agentRunSteps.$inferSelect

// A run's headline, for the history list. stepCount is joined in so the list
// can show "42 steps" without loading them.
export interface AgentRunSummary {
  id: number
  startedAt: string
  finishedAt: string | null
  status: AgentRunStatus
  trigger: AgentRunTrigger
  emailsTotal: number
  emailsProcessed: number
  jobsKept: number
  error: string | null
  stepCount: number
}

// One stored step, shaped exactly like the live AgentTraceEvent so the Runs
// page renders a past run with the very same timeline components. `stats`/`jobs`
// are opaque JSON here (the renderer owns their types) to keep this module free
// of renderer imports.
export interface AgentRunStep {
  seq: number
  at: string
  channel: string
  label: string
  status?: string
  chars?: number
  durationMs?: number
  body?: string
  stats?: unknown
  jobs?: unknown
}

export interface StartAgentRunInput {
  trigger: AgentRunTrigger
  startedAt: string
}

export interface AppendAgentStepInput {
  seq: number
  at: string
  channel: string
  label: string
  status?: string | null
  chars?: number | null
  durationMs?: number | null
  body?: string | null
  stats?: unknown
  jobs?: unknown
}

export interface FinishAgentRunInput {
  status: AgentRunStatus
  finishedAt: string
  emailsTotal?: number
  emailsProcessed?: number
  jobsKept?: number
  error?: string | null
}

export async function startAgentRun(db: AppDatabase, input: StartAgentRunInput): Promise<number> {
  const rows = await db.drizzle
    .insert(agentRuns)
    .values({
      startedAt: new Date(input.startedAt),
      status: 'running',
      trigger: input.trigger,
    })
    .returning({ id: agentRuns.id })
  const row = rows[0]
  if (row === undefined) throw new Error('startAgentRun: insert returned no row')
  return row.id
}

export async function appendAgentStep(
  db: AppDatabase,
  runId: number,
  step: AppendAgentStepInput,
): Promise<void> {
  await db.drizzle.insert(agentRunSteps).values({
    runId,
    seq: step.seq,
    at: new Date(step.at),
    channel: step.channel,
    label: step.label,
    status: step.status ?? null,
    chars: step.chars ?? null,
    durationMs: step.durationMs ?? null,
    body: step.body ?? null,
    // Cast through unknown: these are opaque JSON blobs whose renderer types
    // this module deliberately doesn't import.
    stats: (step.stats ?? null) as StepRow['stats'],
    jobs: (step.jobs ?? null) as StepRow['jobs'],
  })
}

export async function finishAgentRun(
  db: AppDatabase,
  runId: number,
  input: FinishAgentRunInput,
): Promise<void> {
  await db.drizzle
    .update(agentRuns)
    .set({
      status: input.status,
      finishedAt: new Date(input.finishedAt),
      ...(input.emailsTotal === undefined ? {} : { emailsTotal: input.emailsTotal }),
      ...(input.emailsProcessed === undefined ? {} : { emailsProcessed: input.emailsProcessed }),
      ...(input.jobsKept === undefined ? {} : { jobsKept: input.jobsKept }),
      error: input.error ?? null,
    })
    .where(eq(agentRuns.id, runId))
}

function rowToSummary(row: RunRow, stepCount: number): AgentRunSummary {
  return {
    id: row.id,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt === null ? null : row.finishedAt.toISOString(),
    status: row.status,
    trigger: row.trigger,
    emailsTotal: row.emailsTotal,
    emailsProcessed: row.emailsProcessed,
    jobsKept: row.jobsKept,
    error: row.error,
    stepCount,
  }
}

export async function listAgentRuns(db: AppDatabase, limit = 50): Promise<AgentRunSummary[]> {
  const rows = await db.drizzle
    .select({
      run: agentRuns,
      stepCount: sql<number>`count(${agentRunSteps.id})::int`,
    })
    .from(agentRuns)
    .leftJoin(agentRunSteps, eq(agentRunSteps.runId, agentRuns.id))
    .groupBy(agentRuns.id)
    .orderBy(desc(agentRuns.startedAt), desc(agentRuns.id))
    .limit(limit)
  return rows.map((r) => rowToSummary(r.run, r.stepCount))
}

function rowToStep(row: StepRow): AgentRunStep {
  const step: AgentRunStep = {
    seq: row.seq,
    at: row.at.toISOString(),
    channel: row.channel,
    label: row.label,
  }
  if (row.status !== null) step.status = row.status
  if (row.chars !== null) step.chars = row.chars
  if (row.durationMs !== null) step.durationMs = row.durationMs
  if (row.body !== null) step.body = row.body
  if (row.stats !== null) step.stats = row.stats
  if (row.jobs !== null) step.jobs = row.jobs
  return step
}

export async function getAgentRunSteps(db: AppDatabase, runId: number): Promise<AgentRunStep[]> {
  const rows = await db.drizzle
    .select()
    .from(agentRunSteps)
    .where(eq(agentRunSteps.runId, runId))
    .orderBy(asc(agentRunSteps.seq), asc(agentRunSteps.id))
  return rows.map(rowToStep)
}

// Retention: keep the newest `keep` runs, drop the rest (their steps cascade).
// Called after a pass settles so history never grows without bound.
export async function pruneAgentRuns(db: AppDatabase, keep = 50): Promise<number> {
  const survivors = await db.drizzle
    .select({ id: agentRuns.id })
    .from(agentRuns)
    .orderBy(desc(agentRuns.startedAt), desc(agentRuns.id))
    .limit(keep)
  const cutoff = survivors.at(-1)?.id
  if (cutoff === undefined || survivors.length < keep) return 0
  const deleted = await db.drizzle
    .delete(agentRuns)
    .where(lt(agentRuns.id, cutoff))
    .returning({ id: agentRuns.id })
  return deleted.length
}

// On startup, any run still 'running' is a process that died mid-pass (crash,
// kill, quit) — reconcile it to 'stopped' so the history is honest.
export async function reconcileStaleRuns(db: AppDatabase): Promise<number> {
  const updated = await db.drizzle
    .update(agentRuns)
    .set({ status: 'stopped' })
    .where(and(eq(agentRuns.status, 'running'), sql`${agentRuns.finishedAt} is null`))
    .returning({ id: agentRuns.id })
  return updated.length
}
