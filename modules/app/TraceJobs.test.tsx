import type { AgentTraceJob } from '@data'
import { render, screen } from '@test-utils'
import { TraceJobs } from './TraceJobs'

const JOBS: AgentTraceJob[] = [
  {
    id: 'linkedin:1',
    title: 'Senior TypeScript Engineer',
    company: 'Petrol GmbH',
    location: 'München',
    source: 'LinkedIn',
    url: 'https://jobs.example.com/1',
  },
  {
    id: 'linkedin:2',
    title: 'Staff Frontend Engineer',
    company: 'Copper AG',
    location: null,
    source: 'Indeed',
    url: 'https://jobs.example.com/2',
  },
]

describe('TraceJobs', () => {
  // The audit trail: a count is unverifiable, a linked list is not.
  it('lists every ingested job with a link to the real posting', () => {
    render(<TraceJobs jobs={JOBS} />)

    const first = screen.getByRole('link', { name: /Senior TypeScript Engineer/ })
    expect(first).toHaveAttribute('href', 'https://jobs.example.com/1')
    // Opened externally through the window guards, never navigated in-app.
    expect(first).toHaveAttribute('target', '_blank')
    expect(first).toHaveAttribute('rel', 'noreferrer')

    // Feed-style card meta: a place line and a source · company line.
    expect(screen.getByText('München')).toBeInTheDocument()
    expect(screen.getByText('LinkedIn · Petrol GmbH')).toBeInTheDocument()
    // The second job has no location — only the source · company line shows.
    expect(screen.getByText('Indeed · Copper AG')).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('omits the place line for a job with no location', () => {
    render(<TraceJobs jobs={[JOBS[1] as AgentTraceJob]} />)
    // One meta line (source · company), no empty place row.
    expect(screen.getByText('Indeed · Copper AG')).toBeInTheDocument()
    expect(screen.queryByText('München')).not.toBeInTheDocument()
  })

  it('renders nothing when an email yielded no jobs', () => {
    const { container } = render(<TraceJobs jobs={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
