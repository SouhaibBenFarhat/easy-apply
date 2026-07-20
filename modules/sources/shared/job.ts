import type { RemoteScope } from './search-profile'

// The canonical job model (PLAN.md §4.4). Every provider normalizes into
// NormalizedJob; persistence adds the Stored* lifecycle columns. Shared between
// main and renderer, so isolatedDeclarations rules apply: explicit types on
// every export, no exported zod schemas.

export type SourceId =
  | 'ba'
  | 'adzuna'
  | 'arbeitnow'
  | 'himalayas'
  | 'remoteok'
  | 'wwr'
  | 'remotive'
  | 'jooble'
  | 'landingjobs'
  | 'themuse'

export const SOURCE_IDS: readonly SourceId[] = [
  'ba',
  'adzuna',
  'arbeitnow',
  'himalayas',
  'remoteok',
  'wwr',
  'remotive',
  'jooble',
  'landingjobs',
  'themuse',
]

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
  hasSalary?: boolean
  search?: string
  status?: JobStatus | 'none'
  includeHidden?: boolean
  limit?: number
  offset?: number
}
