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
