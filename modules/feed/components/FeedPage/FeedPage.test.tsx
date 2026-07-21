import { LAST_FEED_VISIT_STORAGE_KEY } from '@data'
import {
  createMockElectron,
  fireEvent,
  render,
  screen,
  setupMockElectron,
  userEvent,
  waitFor,
} from '@test-utils'
import { makeJob, makeSalary, mockElementRects } from '../../test-helpers'
import { FeedPage } from './FeedPage'

beforeAll(() => {
  mockElementRects()
})

type Seed = Parameters<typeof createMockElectron>[0]

function seedElectron(seed: Seed): ReturnType<typeof setupMockElectron> {
  return setupMockElectron(createMockElectron(seed))
}

describe('FeedPage', () => {
  it('renders rows from the seeded db', async () => {
    seedElectron({
      jobs: [
        makeJob({ title: 'Rust Engineer' }),
        makeJob({ title: 'Frontend Engineer', sourceId: 'arbeitnow' }),
      ],
    })
    render(<FeedPage />)

    expect(await screen.findByRole('button', { name: /Rust Engineer/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Frontend Engineer/ })).toBeInTheDocument()
    // Source names resolve through useSources into the row meta line.
    expect(screen.getAllByText(/Arbeitnow/).length).toBeGreaterThanOrEqual(1)
  })

  it('shows the no-jobs empty state when the db is empty', async () => {
    render(<FeedPage />)
    expect(await screen.findByText('No jobs yet')).toBeInTheDocument()
    expect(screen.getByText(/Sources sync on launch/)).toBeInTheDocument()
  })

  it('shows the skeleton only while the first load is slow', async () => {
    const mock = seedElectron({})
    vi.spyOn(mock.db.jobs, 'list').mockReturnValue(new Promise(() => {}))
    render(<FeedPage />)

    expect(await screen.findByRole('status', { name: 'Loading feed' })).toBeInTheDocument()
  })

  it('selects a row and shows the detail pane with the crossfade wrapper', async () => {
    seedElectron({ jobs: [makeJob({ title: 'Data Engineer', company: 'Petrol AG' })] })
    const { container } = render(<FeedPage />)

    expect(await screen.findByText('Select a job')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /Data Engineer/ }))

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Data Engineer' }),
    ).toBeInTheDocument()
    expect(container.querySelector('.animate-fade-in')).not.toBeNull()
  })

  it('sets a status through db.jobs.setStatus', async () => {
    const job = makeJob({ title: 'Platform Engineer' })
    const mock = seedElectron({ jobs: [job] })
    const setStatusSpy = vi.spyOn(mock.db.jobs, 'setStatus')
    const user = userEvent.setup()
    render(<FeedPage />)

    await user.click(await screen.findByRole('button', { name: /Platform Engineer/ }))
    await user.click(await screen.findByRole('button', { name: 'Applied' }))

    await waitFor(() => expect(setStatusSpy).toHaveBeenCalledExactlyOnceWith(job.id, 'applied'))
  })

  it('narrows the list with the work-mode segmented control', async () => {
    seedElectron({
      jobs: [
        makeJob({ title: 'Remote role', workMode: 'remote' }),
        makeJob({ title: 'Office role', workMode: 'onsite' }),
      ],
    })
    const user = userEvent.setup()
    render(<FeedPage />)

    await screen.findByRole('button', { name: /Office role/ })
    await user.click(screen.getByRole('tab', { name: 'Remote' }))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Office role/ })).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: /Remote role/ })).toBeInTheDocument()
  })

  it('filters by search text end to end (debounced)', async () => {
    seedElectron({
      jobs: [makeJob({ title: 'React Developer' }), makeJob({ title: 'Java Developer' })],
    })
    render(<FeedPage />)

    const input = await screen.findByRole('searchbox', { name: 'Search jobs' })
    fireEvent.change(input, { target: { value: 'react' } })

    await waitFor(
      () =>
        expect(screen.queryByRole('button', { name: /Java Developer/ })).not.toBeInTheDocument(),
      { timeout: 2000 },
    )
    expect(screen.getByRole('button', { name: /React Developer/ })).toBeInTheDocument()
  })

  it('filters on the salary toggle', async () => {
    seedElectron({
      jobs: [
        makeJob({ title: 'Paid role', salary: makeSalary({ min: 60000, currency: 'EUR' }) }),
        makeJob({ title: 'Quiet role' }),
      ],
    })
    const user = userEvent.setup()
    render(<FeedPage />)

    await screen.findByRole('button', { name: /Quiet role/ })
    await user.click(screen.getByRole('switch', { name: 'Salary' }))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Quiet role/ })).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: /Paid role/ })).toBeInTheDocument()
  })

  it('offers a reset when the filters exclude everything', async () => {
    seedElectron({ jobs: [makeJob({ title: 'Only onsite here', workMode: 'onsite' })] })
    const user = userEvent.setup()
    render(<FeedPage />)

    await screen.findByRole('button', { name: /Only onsite here/ })
    await user.click(screen.getByRole('tab', { name: 'Remote' }))

    expect(await screen.findByText('Nothing matches these filters')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reset filters' }))
    expect(await screen.findByRole('button', { name: /Only onsite here/ })).toBeInTheDocument()
  })

  it('places the new-since divider using the stored last visit', async () => {
    localStorage.setItem(LAST_FEED_VISIT_STORAGE_KEY, '2026-07-19T00:00:00.000Z')
    seedElectron({
      jobs: [
        makeJob({
          title: 'Fresh find',
          postedAt: '2026-07-19T08:00:00.000Z',
          firstSeenAt: '2026-07-19T08:00:00.000Z',
        }),
        makeJob({
          title: 'Old find',
          postedAt: '2026-07-18T08:00:00.000Z',
          firstSeenAt: '2026-07-18T08:00:00.000Z',
        }),
      ],
    })
    render(<FeedPage />)

    await screen.findByRole('button', { name: /Fresh find/ })
    const divider = screen.getByText('New since your last visit')
    const fresh = screen.getByRole('button', { name: /Fresh find/ })
    const old = screen.getByRole('button', { name: /Old find/ })
    expect(fresh.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(divider.compareDocumentPosition(old) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('marks the visit on window blur and on unmount', async () => {
    seedElectron({ jobs: [makeJob()] })
    const { unmount } = render(<FeedPage />)
    await screen.findAllByRole('button')

    expect(localStorage.getItem(LAST_FEED_VISIT_STORAGE_KEY)).toBeNull()
    fireEvent(window, new Event('blur'))
    await waitFor(() => expect(localStorage.getItem(LAST_FEED_VISIT_STORAGE_KEY)).not.toBeNull())

    localStorage.removeItem(LAST_FEED_VISIT_STORAGE_KEY)
    unmount()
    await waitFor(() => expect(localStorage.getItem(LAST_FEED_VISIT_STORAGE_KEY)).not.toBeNull())
  })

  it('hides a job and clears the selection', async () => {
    const job = makeJob({ title: 'Hide me' })
    const mock = seedElectron({ jobs: [job, makeJob({ title: 'Keep me' })] })
    const setHiddenSpy = vi.spyOn(mock.db.jobs, 'setHidden')
    const user = userEvent.setup()
    render(<FeedPage />)

    await user.click(await screen.findByRole('button', { name: /Hide me/ }))
    await user.click(await screen.findByRole('button', { name: 'Hide' }))

    await waitFor(() => expect(setHiddenSpy).toHaveBeenCalledExactlyOnceWith(job.id, true))
    expect(await screen.findByText('Select a job')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Hide me/ })).not.toBeInTheDocument(),
    )
  })

  it('saves notes through db.jobs.setNotes', async () => {
    const job = makeJob({ title: 'Notable role' })
    const mock = seedElectron({ jobs: [job] })
    const setNotesSpy = vi.spyOn(mock.db.jobs, 'setNotes')
    const user = userEvent.setup()
    render(<FeedPage />)

    await user.click(await screen.findByRole('button', { name: /Notable role/ }))
    await user.click(await screen.findByLabelText('Notes'))
    await user.keyboard('ping recruiter')
    await user.tab()

    await waitFor(() =>
      expect(setNotesSpy).toHaveBeenCalledExactlyOnceWith(job.id, 'ping recruiter'),
    )
  })
})
