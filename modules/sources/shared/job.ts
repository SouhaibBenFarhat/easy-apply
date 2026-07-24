import type { RemoteScope } from './search-profile'

// The canonical job model (PLAN.md §4.4). Every provider normalizes into
// NormalizedJob; persistence adds the Stored* lifecycle columns. Shared between
// main and renderer, so isolatedDeclarations rules apply: explicit types on
// every export, no exported zod schemas.

export type SourceId =
  | 'ba'
  | 'arbeitnow'
  | 'himalayas'
  | 'remoteok'
  | 'wwr'
  | 'remotive'
  | 'jooble'
  | 'landingjobs'
  | 'themuse'
  // Email-alert ingestion: jobs parsed from the user's own job-alert inbox
  // over IMAP. `mailbox` is the single credentialed mail connection (the
  // Sources card that holds the Gmail address + App Password); the jobs it
  // emits are tagged with their board's id below so the feed chip, per-source
  // toggle, and cross-source dedupe all work naturally.
  | 'mailbox'
  | 'linkedin'
  | 'indeed'
  | 'stepstone'
  | 'xing'
  | 'glassdoor'
  | 'instaffo'

export const SOURCE_IDS: readonly SourceId[] = [
  'ba',
  'arbeitnow',
  'himalayas',
  'remoteok',
  'wwr',
  'remotive',
  'jooble',
  'landingjobs',
  'themuse',
  'mailbox',
  'linkedin',
  'indeed',
  'stepstone',
  'xing',
  'glassdoor',
  'instaffo',
]

// The email-agent sources: jobs the on-device LLM extracted from the user's
// inbox. No direct API exists for these boards, so the sourceId alone is an
// authoritative "found by the agent" signal; everything else is API-sourced.
export const MAILBOX_SOURCE_IDS: readonly SourceId[] = [
  'mailbox',
  'linkedin',
  'indeed',
  'stepstone',
  'xing',
  'glassdoor',
  'instaffo',
]

// Where a job came from: the inbox agent (LLM email extraction) or a source API.
export type JobOrigin = 'agent' | 'api'

export function isAgentSource(sourceId: SourceId): boolean {
  return (MAILBOX_SOURCE_IDS as readonly string[]).includes(sourceId)
}

export type WorkMode = 'onsite' | 'hybrid' | 'remote' | 'unknown'

export const WORK_MODES: readonly WorkMode[] = ['onsite', 'hybrid', 'remote', 'unknown']

export type JobStatus = 'interested' | 'applied' | 'interview' | 'rejected'

export const JOB_STATUSES: readonly JobStatus[] = ['interested', 'applied', 'interview', 'rejected']

export type SalaryPeriod = 'year' | 'month' | 'hour'

export interface JobSalary {
  min: number | null
  max: number | null
  currency: string | null
  period: SalaryPeriod | null
  isEstimated: boolean
  raw: string | null
}

export interface NormalizedJob {
  id: string // `${sourceId}:${sourceJobId}`
  sourceId: SourceId
  url: string // posting page (attribution link)
  applyUrl: string | null
  title: string
  company: string
  locationRaw: string
  city: string | null
  country: string | null
  workMode: WorkMode
  remoteScope: RemoteScope | null
  salary: JobSalary
  postedAt: string | null // ISO; fetchedAt fallback for sorting
  descriptionHtml: string | null // sanitized with dompurify before render
  tags: string[]
  dedupeKey: string
}

// A job as it lives in the DB: NormalizedJob + sync + tracking lifecycle.
export interface StoredJob extends NormalizedJob {
  firstSeenAt: string
  fetchedAt: string
  status: JobStatus | null
  statusUpdatedAt: string | null
  notes: string | null
  hidden: boolean
}

// Feed query filters — every field optional; omitted fields don't constrain.
export interface FeedFilters {
  workModes?: WorkMode[]
  remoteScopes?: RemoteScope[]
  sources?: SourceId[]
  origin?: JobOrigin // 'agent' (inbox) | 'api'; omitted = both
  hasSalary?: boolean
  search?: string
  status?: JobStatus | 'none'
  includeHidden?: boolean
  limit?: number
  offset?: number
}
