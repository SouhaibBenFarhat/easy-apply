import type { AgentRunSummary, AgentTraceEvent } from '@data'
import {
  createMockElectron,
  render,
  screen,
  setupMockElectron,
  userEvent,
  waitFor,
  within,
} from '@test-utils'
import { RunsPage } from './RunsPage'

type Seed = Parameters<typeof createMockElectron>[0]
function seedElectron(seed: Seed): ReturnType<typeof setupMockElectron> {
  return setupMockElectron(createMockElectron(seed))
}

function run(overrides: Partial<AgentRunSummary> = {}): AgentRunSummary {
  return {
    id: 1,
    startedAt: '2026-07-24T09:00:00.000Z',
    finishedAt: '2026-07-24T09:00:42.000Z',
    status: 'completed',
    trigger: 'manual',
    emailsTotal: 12,
    emailsProcessed: 12,
    jobsKept: 3,
    error: null,
    stepCount: 4,
    ...overrides,
  }
}

const STEPS: AgentTraceEvent[] = [
  {
    seq: 0,
    at: '2026-07-24T09:00:00.000Z',
    channel: 'sync',
    label: 'Sync started',
    status: 'done',
  },
  {
    seq: 1,
    at: '2026-07-24T09:00:42.000Z',
    channel: 'pipeline',
    label: 'Backend roles for you',
    status: 'done',
    durationMs: 42_000,
    jobs: [
      {
        id: 'linkedin:1',
        title: 'Senior Engineer',
        company: 'Acme',
        location: 'München',
        source: 'LinkedIn',
        url: 'https://jobs.example.com/1',
      },
    ],
  },
]

describe('RunsPage', () => {
  it('shows an empty hint with no runs', () => {
    seedElectron({ agentRuns: [] })
    render(<RunsPage />)
    expect(screen.getByText(/No runs yet/)).toBeInTheDocument()
  })

  it('lists runs and opens the newest run’s timeline by default', async () => {
    seedElectron({ agentRuns: [run({ id: 7 })], agentRunSteps: { 7: STEPS } })
    render(<RunsPage />)

    // The run summary is listed…
    expect(await screen.findByText('completed')).toBeInTheDocument()
    expect(screen.getByText(/3 jobs · 12\/12 emails · manual/)).toBeInTheDocument()
    // …its timeline renders in the middle column…
    await waitFor(() => expect(screen.getByText('Sync started')).toBeInTheDocument())
    // …and the run's harvest shows in the Jobs column (scoped, since the
    // timeline also shows each email's jobs under its verdict row).
    const jobsColumn = within(screen.getByRole('region', { name: 'Jobs found' }))
    await waitFor(() =>
      expect(jobsColumn.getByRole('link', { name: /Senior Engineer/ })).toHaveAttribute(
        'href',
        'https://jobs.example.com/1',
      ),
    )
  })

  it('collects every job the run kept into the Jobs column, deduped', async () => {
    const twoJobs: AgentTraceEvent[] = [
      {
        seq: 0,
        at: '2026-07-24T09:00:00.000Z',
        channel: 'pipeline',
        label: 'Email A',
        jobs: [
          {
            id: 'linkedin:1',
            title: 'Senior Engineer',
            company: 'Acme',
            location: 'München',
            source: 'LinkedIn',
            url: 'https://x/1',
          },
        ],
      },
      {
        seq: 1,
        at: '2026-07-24T09:00:10.000Z',
        channel: 'pipeline',
        label: 'Email B',
        jobs: [
          // Duplicate of the first — must collapse.
          {
            id: 'linkedin:1',
            title: 'Senior Engineer',
            company: 'Acme',
            location: 'München',
            source: 'LinkedIn',
            url: 'https://x/1',
          },
          {
            id: 'indeed:2',
            title: 'Backend Dev',
            company: 'Beta',
            location: 'Berlin',
            source: 'Indeed',
            url: 'https://x/2',
          },
        ],
      },
    ]
    seedElectron({ agentRuns: [run({ id: 5, jobsKept: 2 })], agentRunSteps: { 5: twoJobs } })
    render(<RunsPage />)

    // Scope to the Jobs column — the timeline shows each email's jobs too.
    await waitFor(() => expect(screen.getByRole('region', { name: 'Jobs found' })).toBeTruthy())
    const jobsColumn = within(screen.getByRole('region', { name: 'Jobs found' }))
    await waitFor(() =>
      expect(jobsColumn.getByRole('link', { name: /Backend Dev/ })).toBeInTheDocument(),
    )
    // The duplicate LinkedIn job collapses to a single harvest card.
    expect(jobsColumn.getAllByRole('link', { name: /Senior Engineer/ })).toHaveLength(1)
    expect(jobsColumn.getAllByRole('link')).toHaveLength(2)
  })

  it('switches the timeline when another run is selected', async () => {
    seedElectron({
      agentRuns: [run({ id: 2, status: 'failed', jobsKept: 0 }), run({ id: 1 })],
      agentRunSteps: {
        2: [
          {
            seq: 0,
            at: '2026-07-24T10:00:00.000Z',
            channel: 'sync',
            label: 'Boom',
            status: 'failed',
          },
        ],
        1: STEPS,
      },
    })
    const user = userEvent.setup()
    render(<RunsPage />)

    // Newest (failed) run selected first.
    await waitFor(() => expect(screen.getByText('Boom')).toBeInTheDocument())
    // Pick the older completed run → its timeline replaces the failed one.
    await user.click(screen.getByText('completed'))
    await waitFor(() => expect(screen.getByText('Sync started')).toBeInTheDocument())
    expect(screen.queryByText('Boom')).not.toBeInTheDocument()
  })
})
