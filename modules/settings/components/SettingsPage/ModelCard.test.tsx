import type { ModelStatus } from '@data'
import {
  act,
  createModelProgressEmitter,
  createTestQueryClient,
  fireEvent,
  render,
  screen,
  setupMockElectron,
  userEvent,
  waitFor,
} from '@test-utils'
import { ModelCard } from './ModelCard'

const base = {
  modelId: 'llama-3.1-8b-instruct-q4',
  displayName: 'Llama 3.1 8B Instruct (Q4)',
  totalBytes: 4_920_000_000,
  enabled: true,
}
const downloading: ModelStatus = {
  ...base,
  state: 'downloading',
  downloadedBytes: 2_460_000_000,
  error: null,
}
const ready: ModelStatus = { ...base, state: 'ready', downloadedBytes: 4_920_000_000, error: null }
const errored: ModelStatus = { ...base, state: 'error', downloadedBytes: 0, error: 'HTTP 403' }

function seedStatus(status: ModelStatus): void {
  vi.spyOn(window.electron.model, 'status').mockResolvedValue({ success: true, data: status })
}

describe('ModelCard', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('offers a download when the model is absent', async () => {
    render(<ModelCard />)
    expect(await screen.findByRole('button', { name: /Download model/ })).toBeInTheDocument()
    expect(screen.getByText(/Downloads once/)).toBeInTheDocument()
  })

  it('shows a progress bar at the right percent while downloading', async () => {
    seedStatus(downloading)
    render(<ModelCard />)
    const bar = await screen.findByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '50')
  })

  it('shows Ready when the model is installed', async () => {
    seedStatus(ready)
    render(<ModelCard />)
    expect(await screen.findByText('Ready')).toBeInTheDocument()
  })

  it('shows the error and a retry when a download failed', async () => {
    seedStatus(errored)
    render(<ModelCard />)
    expect(await screen.findByText('HTTP 403')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Retry download/ })).toBeInTheDocument()
  })

  it('starts the download on click', async () => {
    const dl = vi.spyOn(window.electron.model, 'download')
    const user = userEvent.setup()
    render(<ModelCard />)
    await user.click(await screen.findByRole('button', { name: /Download model/ }))
    await waitFor(() => expect(dl).toHaveBeenCalledTimes(1))
  })

  it('advances the bar as progress events arrive', async () => {
    const mock = setupMockElectron()
    const emit = createModelProgressEmitter(mock)
    const client = createTestQueryClient()
    render(<ModelCard />, { client })
    await screen.findByRole('button', { name: /Download model/ })

    act(() => {
      emit({ downloadedBytes: 3_690_000_000, totalBytes: 4_920_000_000, done: false })
    })
    const bar = await screen.findByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '75')
  })

  it('removes the model behind an armed confirm when ready', async () => {
    seedStatus(ready)
    const rm = vi.spyOn(window.electron.model, 'remove')
    const user = userEvent.setup()
    render(<ModelCard />)

    // First click only arms the confirm — nothing is removed yet.
    await user.click(await screen.findByRole('button', { name: 'Remove' }))
    expect(rm).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Confirm remove' }))
    await waitFor(() => expect(rm).toHaveBeenCalledTimes(1))
  })

  it('turns the AI off to free RAM and shows the off state', async () => {
    seedStatus(ready)
    const setEnabled = vi.spyOn(window.electron.model, 'setEnabled')
    const user = userEvent.setup()
    render(<ModelCard />)

    await user.click(await screen.findByRole('switch', { name: 'Enable on-device AI' }))
    await waitFor(() => expect(setEnabled).toHaveBeenCalledExactlyOnceWith(false))
  })

  it('shows the off state when AI is disabled', async () => {
    seedStatus({ ...ready, enabled: false })
    render(<ModelCard />)
    expect(await screen.findByText(/unloaded to free RAM/)).toBeInTheDocument()
    // No Ready badge and no remove/download actions while off.
    expect(screen.queryByText('Ready')).not.toBeInTheDocument()
  })

  it('disarms the remove confirmation after the timeout', async () => {
    seedStatus(ready)
    const rm = vi.spyOn(window.electron.model, 'remove')
    render(<ModelCard />)
    await screen.findByRole('button', { name: 'Remove' })

    // Fake timers only from here: the initial status query already settled.
    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.getByRole('button', { name: 'Confirm remove' })).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
    expect(rm).not.toHaveBeenCalled()
  })
})
