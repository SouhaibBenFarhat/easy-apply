import type { JobSalary, StoredJob } from '@sources/shared'

// Fixture-lite StoredJob factory for the tracker tests — a deliberate local
// twin of @feed's test-helpers: features can't import each other (L3 rules),
// and @test-utils holds infrastructure, not domain factories. Branch-free on
// purpose (it lives outside *.test.* and therefore counts toward coverage):
// defaults spread first, overrides win.

let counter = 0

export function makeSalary(overrides: Partial<JobSalary> = {}): JobSalary {
  return {
    min: null,
    max: null,
    currency: null,
    period: null,
    isEstimated: false,
    raw: null,
    ...overrides,
  }
}

export function makeJob(overrides: Partial<StoredJob> = {}): StoredJob {
  counter += 1
  return {
    id: `arbeitnow:job-${counter}`,
    sourceId: 'arbeitnow',
    url: `https://www.arbeitnow.com/jobs/job-${counter}`,
    applyUrl: null,
    title: `Software Engineer ${counter}`,
    company: 'Acme GmbH',
    locationRaw: 'München, Germany',
    city: 'München',
    country: 'DE',
    workMode: 'hybrid',
    remoteScope: null,
    salary: makeSalary(),
    postedAt: '2026-07-19T10:00:00.000Z',
    descriptionHtml: null,
    tags: [],
    dedupeKey: `dedupe-${counter}`,
    firstSeenAt: '2026-07-19T11:00:00.000Z',
    fetchedAt: '2026-07-19T11:00:00.000Z',
    status: null,
    statusUpdatedAt: null,
    notes: null,
    hidden: false,
    ...overrides,
  }
}
