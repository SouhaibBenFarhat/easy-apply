import type { ModelStatus } from '@data'
import { render, screen, userEvent } from '@test-utils'
import { ModelPicker } from './ModelPicker'

function status(overrides: Partial<ModelStatus> = {}): ModelStatus {
  return {
    state: 'ready',
    modelId: 'llama',
    displayName: 'Llama 8B',
    totalBytes: 4_920_000_000,
    downloadedBytes: 4_920_000_000,
    error: null,
    enabled: true,
    reasoning: false,
    catalog: [
      {
        id: 'llama',
        displayName: 'Llama 8B',
        sizeBytes: 4_920_000_000,
        reasoning: false,
        installed: true,
      },
      {
        id: 'deepseek',
        displayName: 'DeepSeek 14B',
        sizeBytes: 8_990_000_000,
        reasoning: true,
        installed: false,
      },
    ],
    ...overrides,
  }
}

function handlers(): {
  onSelect: (modelId: string) => void
  onDownload: (modelId: string) => void
  onCancel: () => void
  onRemove: (modelId: string) => void
} {
  return { onSelect: vi.fn(), onDownload: vi.fn(), onCancel: vi.fn(), onRemove: vi.fn() }
}

describe('ModelPicker', () => {
  it('marks the selected model and shows no thinking tag', () => {
    render(<ModelPicker status={status()} removeArmedId={null} {...handlers()} />)

    expect(screen.getByRole('button', { name: 'Llama 8B' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Thinks')).not.toBeInTheDocument()
  })

  it('selects a different model on click', async () => {
    const h = handlers()
    const user = userEvent.setup()
    render(<ModelPicker status={status()} removeArmedId={null} {...h} />)

    await user.click(screen.getByRole('button', { name: 'DeepSeek 14B' }))
    expect(h.onSelect).toHaveBeenCalledWith('deepseek')
  })

  it('downloads a model from its own row', async () => {
    const h = handlers()
    const user = userEvent.setup()
    render(<ModelPicker status={status()} removeArmedId={null} {...h} />)

    // DeepSeek is not installed → its row offers a Download.
    await user.click(screen.getByRole('button', { name: 'Download DeepSeek 14B' }))
    expect(h.onDownload).toHaveBeenCalledWith('deepseek')
  })

  it('shows a progress bar + cancel while a model downloads', async () => {
    const h = handlers()
    const user = userEvent.setup()
    render(
      <ModelPicker
        status={status({ state: 'downloading', downloadedBytes: 2_460_000_000 })}
        removeArmedId={null}
        {...h}
      />,
    )

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
    await user.click(screen.getByRole('button', { name: 'Cancel download' }))
    expect(h.onCancel).toHaveBeenCalledTimes(1)
  })

  it('removes an installed model from its row', async () => {
    const h = handlers()
    const user = userEvent.setup()
    render(<ModelPicker status={status()} removeArmedId={null} {...h} />)

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(h.onRemove).toHaveBeenCalledWith('llama')
  })

  it('shows the armed confirm on the armed row', () => {
    render(<ModelPicker status={status()} removeArmedId="llama" {...handlers()} />)
    expect(screen.getByRole('button', { name: 'Confirm remove' })).toBeInTheDocument()
  })
})
