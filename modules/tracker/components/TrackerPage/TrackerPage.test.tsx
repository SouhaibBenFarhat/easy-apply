import { LAST_FEED_VISIT_STORAGE_KEY } from '@data'
import {
  createMockElectron,
  fireEvent,
  render,
  screen,
  setupMockElectron,
  userEvent,
  waitFor,
  within,
} from '@test-utils'
import { makeJob } from '../../test-helpers'
import { TrackerPage } from './TrackerPage'

// happy-dom lacks pointer-capture and scrollIntoView APIs that Radix Select
// relies on (same shim as the ui-kit Select tests).
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

type Seed = Parameters<typeof createMockElectron>[0]

function seedElectron(seed: Seed): ReturnType<typeof setupMockElectron> {
  return setupMockElectron(createMockElectron(seed))
}

function groupHeader(name: string): HTMLElement {
  const header = screen.getByRole('heading', { level: 2, name }).closest('header')
  if (header === null) throw new Error(`no header element around the ${name} heading`)
  return header
}

describe('TrackerPage', () => {
  it('groups tracked jobs by status, keeps hidden tracked jobs, drops untracked ones', async () => {
    seedElectron({
      jobs: [
        makeJob({
          title: 'Curious role',
          status: 'interested',
          statusUpdatedAt: '2026-07-20T10:00:00.000Z',
        }),
        makeJob({
          title: 'Sent-off role',
          status: 'applied',
          statusUpdatedAt: '2026-07-20T10:00:00.000Z',
        }),
        makeJob({
          title: 'On-site loop role',
          status: 'interview',
          statusUpdatedAt: '2026-07-20T10:00:00.000Z',
        }),
        makeJob({
          title: 'Passed-on role',
          status: 'rejected',
          statusUpdatedAt: '2026-07-20T10:00:00.000Z',
        }),
        makeJob({ title: 'Untracked role' }),
        makeJob({
          title: 'Hidden but applied role',
          status: 'applied',
          statusUpdatedAt: '2026-07-20T10:00:00.000Z',
          hidden: true,
        }),
      ],
    })
    render(<TrackerPage />)

    expect(await screen.findByText('Curious role')).toBeInTheDocument()
    expect(screen.getByText('Sent-off role')).toBeInTheDocument()
    expect(screen.getByText('On-site loop role')).toBeInTheDocument()
    expect(screen.getByText('Passed-on role')).toBeInTheDocument()
    // Tracked jobs stay visible even when hidden from the feed.
    expect(screen.getByText('Hidden but applied role')).toBeInTheDocument()
    expect(screen.queryByText('Untracked role')).not.toBeInTheDocument()
  })

  it('orders the sections in pipeline order regardless of seed order', async () => {
    seedElectron({
      jobs: [
        makeJob({ status: 'rejected', statusUpdatedAt: '2026-07-20T10:00:00.000Z' }),
        makeJob({ status: 'interview', statusUpdatedAt: '2026-07-20T10:00:00.000Z' }),
        makeJob({ status: 'applied', statusUpdatedAt: '2026-07-20T10:00:00.000Z' }),
        makeJob({ status: 'interested', statusUpdatedAt: '2026-07-20T10:00:00.000Z' }),
      ],
    })
    render(<TrackerPage />)

    await screen.findByRole('heading', { level: 2, name: 'Interested' })
    const headings = screen.getAllByRole('heading', { level: 2 })
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Interested',
      'Applied',
      'Interview',
      'Rejected',
    ])
  })

  it('shows per-group counts in status-colored badges and skips empty groups', async () => {
    seedElectron({
      jobs: [
        makeJob({ status: 'interested', statusUpdatedAt: '2026-07-20T10:00:00.000Z' }),
        makeJob({ status: 'interested', statusUpdatedAt: '2026-07-20T10:00:00.000Z' }),
        makeJob({ status: 'applied', statusUpdatedAt: '2026-07-20T10:00:00.000Z' }),
      ],
    })
    render(<TrackerPage />)

    await screen.findByRole('heading', { level: 2, name: 'Interested' })
    expect(within(groupHeader('Interested')).getByText('2')).toHaveClass('text-warning')
    expect(within(groupHeader('Applied')).getByText('1')).toHaveClass('text-success')
    expect(screen.queryByRole('heading', { level: 2, name: 'Interview' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'Rejected' })).not.toBeInTheDocument()
  })

  it('shows the empty state when nothing is tracked', async () => {
    seedElectron({ jobs: [makeJob({ title: 'Untracked role' })] })
    render(<TrackerPage />)

    expect(await screen.findByText('Nothing tracked yet')).toBeInTheDocument()
    expect(
      screen.getByText('Mark jobs as Interested or Applied in the Feed and they show up here.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Untracked role')).not.toBeInTheDocument()
  })

  it('shows the skeleton only while the first load is slow', async () => {
    const mock = seedElectron({})
    vi.spyOn(mock.db.jobs, 'list').mockReturnValue(new Promise(() => {}))
    render(<TrackerPage />)

    expect(await screen.findByRole('status', { name: 'Loading tracker' })).toBeInTheDocument()
  })

  it('moves a job along the pipeline through db.jobs.setStatus', async () => {
    const job = makeJob({
      title: 'Movable role',
      status: 'interested',
      statusUpdatedAt: '2026-07-20T10:00:00.000Z',
    })
    const mock = seedElectron({ jobs: [job] })
    const setStatusSpy = vi.spyOn(mock.db.jobs, 'setStatus')
    const user = userEvent.setup()
    render(<TrackerPage />)

    await user.click(await screen.findByRole('combobox', { name: 'Set status' }))
    await user.click(await screen.findByRole('option', { name: 'Applied' }))

    await waitFor(() => expect(setStatusSpy).toHaveBeenCalledExactlyOnceWith(job.id, 'applied'))
    expect(await screen.findByRole('heading', { level: 2, name: 'Applied' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'Interested' })).not.toBeInTheDocument()
  })

  it('removes a job from the tracker with the X button', async () => {
    const job = makeJob({
      title: 'Removable role',
      status: 'applied',
      statusUpdatedAt: '2026-07-20T10:00:00.000Z',
    })
    const mock = seedElectron({ jobs: [job] })
    const setStatusSpy = vi.spyOn(mock.db.jobs, 'setStatus')
    const user = userEvent.setup()
    render(<TrackerPage />)

    await user.click(await screen.findByRole('button', { name: 'Remove from tracker' }))

    await waitFor(() => expect(setStatusSpy).toHaveBeenCalledExactlyOnceWith(job.id, null))
    expect(await screen.findByText('Nothing tracked yet')).toBeInTheDocument()
  })

  it('prefers applyUrl for the open-posting link', async () => {
    seedElectron({
      jobs: [
        makeJob({
          status: 'applied',
          statusUpdatedAt: '2026-07-20T10:00:00.000Z',
          url: 'https://board.example/post',
          applyUrl: 'https://company.example/apply',
        }),
      ],
    })
    render(<TrackerPage />)

    expect(await screen.findByRole('link', { name: 'Open posting' })).toHaveAttribute(
      'href',
      'https://company.example/apply',
    )
  })

  it('never writes the lastFeedVisit watermark', async () => {
    seedElectron({
      jobs: [makeJob({ status: 'interested', statusUpdatedAt: '2026-07-20T10:00:00.000Z' })],
    })
    const { unmount } = render(<TrackerPage />)
    await screen.findByRole('heading', { level: 2, name: 'Interested' })

    // Blur and unmount both move the watermark on the Feed page — the tracker
    // must leave the feed's "new since last visit" divider alone.
    fireEvent(window, new Event('blur'))
    unmount()
    expect(localStorage.getItem(LAST_FEED_VISIT_STORAGE_KEY)).toBeNull()
  })
})
