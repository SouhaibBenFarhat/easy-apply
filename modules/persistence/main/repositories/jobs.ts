import type { FeedFilters, JobStatus, NormalizedJob, StoredJob } from '@sources/shared'
import { MAILBOX_SOURCE_IDS } from '@sources/shared'
import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  notInArray,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'
import type { AppDatabase } from '../db'
import { jobs } from '../schema'

type JobRow = typeof jobs.$inferSelect
type JobInsert = typeof jobs.$inferInsert

// ---------------------------------------------------------------------------
// Row ↔ model mapping (snake_case flat rows ↔ camelCase models, nested salary,
// timestamptz ↔ ISO strings)
// ---------------------------------------------------------------------------

function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString()
}

function isoOrNull(value: Date | string | null): string | null {
  return value === null ? null : iso(value)
}

function rowToStoredJob(row: JobRow): StoredJob {
  return {
    id: row.id,
    sourceId: row.sourceId,
    url: row.url,
    applyUrl: row.applyUrl,
    title: row.title,
    company: row.company,
    locationRaw: row.locationRaw,
    city: row.city,
    country: row.country,
    workMode: row.workMode,
    remoteScope: row.remoteScope,
    salary: {
      min: row.salaryMin,
      max: row.salaryMax,
      currency: row.salaryCurrency,
      period: row.salaryPeriod,
      isEstimated: row.salaryIsEstimated,
      raw: row.salaryRaw,
    },
    postedAt: isoOrNull(row.postedAt),
    descriptionHtml: row.descriptionHtml,
    tags: row.tags,
    dedupeKey: row.dedupeKey,
    firstSeenAt: iso(row.firstSeenAt),
    fetchedAt: iso(row.fetchedAt),
    status: row.status,
    statusUpdatedAt: isoOrNull(row.statusUpdatedAt),
    notes: row.notes,
    hidden: row.hidden,
  }
}

function jobToRow(job: NormalizedJob, fetchedAt: Date): JobInsert {
  return {
    id: job.id,
    sourceId: job.sourceId,
    url: job.url,
    applyUrl: job.applyUrl,
    title: job.title,
    company: job.company,
    locationRaw: job.locationRaw,
    city: job.city,
    country: job.country,
    workMode: job.workMode,
    remoteScope: job.remoteScope,
    salaryMin: job.salary.min,
    salaryMax: job.salary.max,
    salaryCurrency: job.salary.currency,
    salaryPeriod: job.salary.period,
    salaryIsEstimated: job.salary.isEstimated,
    salaryRaw: job.salary.raw,
    postedAt: job.postedAt === null ? null : new Date(job.postedAt),
    descriptionHtml: job.descriptionHtml,
    tags: job.tags,
    dedupeKey: job.dedupeKey,
    firstSeenAt: fetchedAt, // preserved on conflict — set only on first insert
    fetchedAt,
  }
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export async function upsertJobs(
  db: AppDatabase,
  incoming: NormalizedJob[],
  fetchedAt: string,
): Promise<{ inserted: number; updated: number }> {
  // Postgres rejects the same id twice within one INSERT … ON CONFLICT
  // statement — dedupe the batch first (last write wins).
  const byId = new Map(incoming.map((job) => [job.id, job]))
  const unique = [...byId.values()]
  if (unique.length === 0) return { inserted: 0, updated: 0 }

  const ids = unique.map((job) => job.id)
  const existing = await db.drizzle.select({ id: jobs.id }).from(jobs).where(inArray(jobs.id, ids))
  const existingIds = new Set(existing.map((row) => row.id))

  const fetched = new Date(fetchedAt)
  await db.drizzle
    .insert(jobs)
    .values(unique.map((job) => jobToRow(job, fetched)))
    .onConflictDoUpdate({
      target: jobs.id,
      // Volatile (provider-owned) fields refresh on every sync;
      // first_seen_at / status / status_updated_at / notes / hidden are
      // user/lifecycle state and must never be clobbered by a re-sync.
      set: {
        sourceId: sql`excluded.source_id`,
        url: sql`excluded.url`,
        applyUrl: sql`excluded.apply_url`,
        title: sql`excluded.title`,
        company: sql`excluded.company`,
        locationRaw: sql`excluded.location_raw`,
        city: sql`excluded.city`,
        country: sql`excluded.country`,
        workMode: sql`excluded.work_mode`,
        remoteScope: sql`excluded.remote_scope`,
        salaryMin: sql`excluded.salary_min`,
        salaryMax: sql`excluded.salary_max`,
        salaryCurrency: sql`excluded.salary_currency`,
        salaryPeriod: sql`excluded.salary_period`,
        salaryIsEstimated: sql`excluded.salary_is_estimated`,
        salaryRaw: sql`excluded.salary_raw`,
        postedAt: sql`excluded.posted_at`,
        descriptionHtml: sql`excluded.description_html`,
        tags: sql`excluded.tags`,
        dedupeKey: sql`excluded.dedupe_key`,
        fetchedAt: sql`excluded.fetched_at`,
      },
    })

  return { inserted: ids.length - existingIds.size, updated: existingIds.size }
}

// Escape LIKE wildcards so user input matches literally (backslash is the
// default Postgres escape character).
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (char) => `\\${char}`)
}

export async function listFeed(db: AppDatabase, filters: FeedFilters = {}): Promise<StoredJob[]> {
  const conditions: SQL[] = []

  if (filters.workModes !== undefined && filters.workModes.length > 0)
    conditions.push(inArray(jobs.workMode, filters.workModes))
  if (filters.remoteScopes !== undefined && filters.remoteScopes.length > 0)
    conditions.push(inArray(jobs.remoteScope, filters.remoteScopes))
  if (filters.sources !== undefined && filters.sources.length > 0)
    conditions.push(inArray(jobs.sourceId, filters.sources))
  // Origin: agent = inbox/LLM-extracted boards; api = everything else.
  if (filters.origin === 'agent') conditions.push(inArray(jobs.sourceId, [...MAILBOX_SOURCE_IDS]))
  else if (filters.origin === 'api')
    conditions.push(notInArray(jobs.sourceId, [...MAILBOX_SOURCE_IDS]))
  if (filters.hasSalary === true) {
    const salaried = or(isNotNull(jobs.salaryMin), isNotNull(jobs.salaryMax))
    if (salaried !== undefined) conditions.push(salaried)
  }
  if (filters.search !== undefined && filters.search.trim() !== '') {
    const pattern = `%${escapeLike(filters.search.trim())}%`
    const matches = or(ilike(jobs.title, pattern), ilike(jobs.company, pattern))
    if (matches !== undefined) conditions.push(matches)
  }
  if (filters.status !== undefined)
    conditions.push(
      filters.status === 'none' ? isNull(jobs.status) : eq(jobs.status, filters.status),
    )
  if (filters.includeHidden !== true) conditions.push(eq(jobs.hidden, false))

  // NO default limit. The feed used to cap at 200 rows, which meant a database
  // holding 747 jobs silently returned the same 200 forever — new arrivals
  // could only displace older rows, never grow the list, and the truncation was
  // invisible. `limit`/`offset` are honoured when a caller asks for them
  // (pagination, tests); absent, the feed is the whole matching set. The list is
  // virtualized, and every row of the full set weighs ~4 KB.
  const query = db.drizzle
    .select()
    .from(jobs)
    .where(and(...conditions))
    .orderBy(sql`${jobs.postedAt} desc nulls last`, desc(jobs.firstSeenAt))
    .$dynamic()
  if (filters.limit !== undefined) query.limit(filters.limit)
  if (filters.offset !== undefined && filters.offset > 0) query.offset(filters.offset)
  const rows = await query
  return rows.map(rowToStoredJob)
}

export async function getJob(db: AppDatabase, id: string): Promise<StoredJob | null> {
  const rows = await db.drizzle.select().from(jobs).where(eq(jobs.id, id)).limit(1)
  const row = rows[0]
  return row === undefined ? null : rowToStoredJob(row)
}

export async function setJobStatus(
  db: AppDatabase,
  id: string,
  status: JobStatus | null,
): Promise<StoredJob | null> {
  const rows = await db.drizzle
    .update(jobs)
    .set({ status, statusUpdatedAt: new Date() })
    .where(eq(jobs.id, id))
    .returning()
  const row = rows[0]
  return row === undefined ? null : rowToStoredJob(row)
}

export async function setJobNotes(
  db: AppDatabase,
  id: string,
  notes: string | null,
): Promise<StoredJob | null> {
  const rows = await db.drizzle.update(jobs).set({ notes }).where(eq(jobs.id, id)).returning()
  const row = rows[0]
  return row === undefined ? null : rowToStoredJob(row)
}

export async function setJobHidden(
  db: AppDatabase,
  id: string,
  hidden: boolean,
): Promise<StoredJob | null> {
  const rows = await db.drizzle.update(jobs).set({ hidden }).where(eq(jobs.id, id)).returning()
  const row = rows[0]
  return row === undefined ? null : rowToStoredJob(row)
}
