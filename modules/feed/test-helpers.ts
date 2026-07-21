import type { JobSalary, StoredJob } from '@sources/shared'

// Fixture-lite StoredJob factory for the feed tests. Deliberately branch-free
// (it lives outside *.test.* and therefore counts toward coverage): defaults
// spread first, overrides win.

// happy-dom lays out nothing: every rect is 0×0, and the virtualizer computes
// a null range for a zero-height scroll container (react-virtual reads
// offsetWidth/offsetHeight; happy-dom hard-codes both to 0). Give all elements
// a fixed size so JobList renders a realistic visible window in tests (call
// from beforeAll in any file that mounts the list; the per-file DOM sandbox
// keeps the prototype patch contained).
export function mockElementRects(width = 420, height = 600): void {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: () => width,
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get: () => height,
  })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () =>
      ({
        width,
        height,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect,
  )
}

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
