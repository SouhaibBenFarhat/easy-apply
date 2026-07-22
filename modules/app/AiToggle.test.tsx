import { render, screen, userEvent, waitFor } from '@test-utils'
import { AiToggle } from './AiToggle'

describe('AiToggle', () => {
  it('shows AI on by default and toggles it off', async () => {
    const setEnabled = vi.spyOn(window.electron.model, 'setEnabled')
    const user = userEvent.setup()
    render(<AiToggle />)

    const button = await screen.findByRole('button', { name: /AI on/ })
    expect(button).toHaveAttribute('aria-pressed', 'true')

    await user.click(button)
    await waitFor(() => expect(setEnabled).toHaveBeenCalledExactlyOnceWith(false))
  })

  it('reflects the off state', async () => {
    vi.spyOn(window.electron.model, 'status').mockResolvedValue({
      success: true,
      data: {
        state: 'ready',
        modelId: 'm',
        displayName: 'M',
        totalBytes: 1,
        downloadedBytes: 1,
        error: null,
        enabled: false,
        reasoning: false,
        catalog: [],
      },
    })
    render(<AiToggle />)
    const button = await screen.findByRole('button', { name: /AI off/ })
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })
})
