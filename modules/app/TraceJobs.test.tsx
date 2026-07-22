import type { AgentTraceJob } from '@data'
import { render, screen } from '@test-utils'
import { TraceJobs } from './TraceJobs'

const JOBS: AgentTraceJob[] = [
  {
    id: 'linkedin:1',
    title: 'Senior TypeScript Engineer',
    company: 'Petrol GmbH',
    url: 'https://jobs.example.com/1',
  },
  {
    id: 'linkedin:2',
    title: 'Staff Frontend Engineer',
    company: 'Copper AG',
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

    expect(screen.getByText('Petrol GmbH')).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('renders nothing when an email yielded no jobs', () => {
    const { container } = render(<TraceJobs jobs={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
