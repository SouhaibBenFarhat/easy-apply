import type { ModelStatus } from '@data'
import { render, screen, userEvent, waitFor } from '@test-utils'
import { ModelBanner } from './ModelBanner'

async function connectInbox(): Promise<void> {
  await window.electron.mailbox.add('one@gmail.com', 'pw')
}

function seedModel(state: ModelStatus['state']): void {
  vi.spyOn(window.electron.model, 'status').mockResolvedValue({
    success: true,
    data: {
      state,
      modelId: 'm',
      displayName: 'M',
      totalBytes: 1,
      downloadedBytes: state === 'ready' ? 1 : 0,
      error: state === 'error' ? 'boom' : null,
      enabled: true,
      reasoning: false,
      catalog: [],
    },
  })
}

describe('ModelBanner', () => {
  it('prompts to install when an inbox is connected and the model is absent', async () => {
    await connectInbox()
    render(<ModelBanner onOpen={vi.fn()} />)
    expect(await screen.findByRole('button', { name: 'Install in Settings' })).toBeInTheDocument()
    expect(screen.getByText(/needs the on-device AI model/)).toBeInTheDocument()
  })

  it('also prompts when a download errored', async () => {
    await connectInbox()
    seedModel('error')
    render(<ModelBanner onOpen={vi.fn()} />)
    expect(await screen.findByRole('button', { name: 'Install in Settings' })).toBeInTheDocument()
  })

  it('stays hidden when no inbox is connected', async () => {
    render(<ModelBanner onOpen={vi.fn()} />)
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Install in Settings' })).not.toBeInTheDocument(),
    )
  })

  it('stays hidden once the model is ready', async () => {
    await connectInbox()
    seedModel('ready')
    render(<ModelBanner onOpen={vi.fn()} />)
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Install in Settings' })).not.toBeInTheDocument(),
    )
  })

  it('opens settings on click', async () => {
    await connectInbox()
    const onOpen = vi.fn()
    const user = userEvent.setup()
    render(<ModelBanner onOpen={onOpen} />)
    await user.click(await screen.findByRole('button', { name: 'Install in Settings' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
