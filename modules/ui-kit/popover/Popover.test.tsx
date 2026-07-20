import { render, screen, userEvent } from '@test-utils'

import { Popover, PopoverContent, PopoverTrigger } from './Popover'

function renderPopover(): ReturnType<typeof render> {
  return render(
    <Popover>
      <PopoverTrigger>Open popover</PopoverTrigger>
      <PopoverContent>Popover body</PopoverContent>
    </Popover>,
  )
}

describe('Popover', () => {
  it('renders the trigger', () => {
    renderPopover()
    expect(screen.getByRole('button', { name: 'Open popover' })).toBeInTheDocument()
  })

  it('defaults the trigger to type button', () => {
    renderPopover()
    expect(screen.getByRole('button', { name: 'Open popover' })).toHaveAttribute('type', 'button')
  })

  it('shows content with the dialog role on click', async () => {
    const user = userEvent.setup()
    renderPopover()
    await user.click(screen.getByRole('button', { name: 'Open popover' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Popover body')
  })

  it('applies semantic styling classes to the content', async () => {
    const user = userEvent.setup()
    renderPopover()
    await user.click(screen.getByRole('button', { name: 'Open popover' }))
    const content = await screen.findByRole('dialog')
    expect(content).toHaveClass('glass-overlay', 'border-border-subtle', 'shadow-elevation-high')
  })
})
