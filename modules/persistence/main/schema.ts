import type { JobStatus, RemoteScope, SalaryPeriod, SourceId, WorkMode } from '@sources/shared'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

// Persistence schema (PLAN.md §4.5) — PGlite (WASM Postgres) + Drizzle.
// Column shapes mirror NormalizedJob/StoredJob (modules/sources/shared/job.ts);
// the row↔model mapping lives in repositories/jobs.ts. $type<>() narrows the
// TypeScript view only — the SQL stays plain text/jsonb.

export const jobs = pgTable(
  'jobs',
  {
    id: text('id').primaryKey(), // `${sourceId}:${sourceJobId}`
    sourceId: text('source_id').$type<SourceId>().notNull(),
    url: text('url').notNull(),
    applyUrl: text('apply_url'),
    title: text('title').notNull(),
    company: text('company').notNull(),
    locationRaw: text('location_raw').notNull(),
    city: text('city'),
    country: text('country'),
    workMode: text('work_mode').$type<WorkMode>().notNull(),
    remoteScope: text('remote_scope').$type<RemoteScope>(),
    salaryMin: real('salary_min'),
    salaryMax: real('salary_max'),
    salaryCurrency: text('salary_currency'),
    salaryPeriod: text('salary_period').$type<SalaryPeriod>(),
    salaryIsEstimated: boolean('salary_is_estimated').notNull().default(false),
    salaryRaw: text('salary_raw'),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    descriptionHtml: text('description_html'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    dedupeKey: text('dedupe_key').notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    status: text('status').$type<JobStatus>(),
    statusUpdatedAt: timestamp('status_updated_at', { withTimezone: true }),
    notes: text('notes'),
    hidden: boolean('hidden').notNull().default(false),
  },
  (table) => [
    index('jobs_posted_at_idx').on(table.postedAt.desc()),
    index('jobs_dedupe_key_idx').on(table.dedupeKey),
    index('jobs_source_id_idx').on(table.sourceId),
    index('jobs_status_idx').on(table.status),
  ],
)

export const syncRuns = pgTable('sync_runs', {
  id: serial('id').primaryKey(),
  sourceId: text('source_id').$type<SourceId>().notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  ok: boolean('ok'),
  error: text('error'),
  inserted: integer('inserted').notNull().default(0),
  updated: integer('updated').notNull().default(0),
})

export const providerState = pgTable('provider_state', {
  sourceId: text('source_id').$type<SourceId>().primaryKey(),
  enabled: boolean('enabled').notNull(),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  configJson: text('config_json'), // safeStorage-encrypted, never plaintext
})

// Agent-run history: one row per pass (manual or scheduled), so the activity
// timeline survives a restart and a run can be re-inspected. The live trace is
// still an in-memory push; this is the durable record behind the Runs page.
export type AgentRunStatus = 'running' | 'completed' | 'stopped' | 'failed'
export type AgentRunTrigger = 'manual' | 'scheduled'

export const agentRuns = pgTable(
  'agent_runs',
  {
    id: serial('id').primaryKey(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    // 'running' until the pass settles — a row left 'running' after a restart
    // is a crash/kill, surfaced as such rather than silently completed.
    status: text('status').$type<AgentRunStatus>().notNull(),
    trigger: text('trigger').$type<AgentRunTrigger>().notNull(),
    emailsTotal: integer('emails_total').notNull().default(0),
    emailsProcessed: integer('emails_processed').notNull().default(0),
    jobsKept: integer('jobs_kept').notNull().default(0),
    error: text('error'),
  },
  (table) => [index('agent_runs_started_at_idx').on(table.startedAt.desc())],
)

// One step per trace event, in one run. Stores the FULL event (body included)
// so a past run renders identically to the live panel.
export const agentRunSteps = pgTable(
  'agent_run_steps',
  {
    id: serial('id').primaryKey(),
    // The run this step belongs to — cascade so pruning a run drops its steps.
    runId: integer('run_id')
      .notNull()
      .references(() => agentRuns.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(), // per-run order, mirrors the live trace seq
    at: timestamp('at', { withTimezone: true }).notNull(),
    channel: text('channel').notNull(),
    label: text('label').notNull(),
    status: text('status'), // 'done' | 'failed' | 'skipped' | null
    chars: integer('chars'),
    durationMs: integer('duration_ms'),
    body: text('body'), // full prompt/response/reasoning text
    stats: jsonb('stats'), // AgentPipelineStats snapshot, on pipeline events
    jobs: jsonb('jobs'), // AgentTraceJob[], on verdict events
  },
  (table) => [index('agent_run_steps_run_id_idx').on(table.runId, table.seq)],
)
