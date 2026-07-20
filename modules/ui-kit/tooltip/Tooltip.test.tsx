import { render, screen, userEvent } from '@test-utils'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './Tooltip'

function renderTooltip(): ReturnType<typeof render> {
  return render(
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>Tooltip text</TooltipContent>
      </Tooltip>
    </TooltipProvider>,
  )
}

describe('Tooltip', () => {
  it('renders the trigger', () => {
    renderTooltip()
    expect(screen.getByRole('button', { name: 'Hover me' })).toBeInTheDocument()
  })

  it('defaults the trigger to type button', () => {
    renderTooltip()
    expect(screen.getByRole('button', { name: 'Hover me' })).toHaveAttribute('type', 'button')
  })

  it('shows content with the tooltip role on hover', async () => {
    const user = userEvent.setup()
    renderTooltip()
    await user.hover(screen.getByRole('button', { name: 'Hover me' }))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Tooltip text')
  })

  it('applies semantic styling classes to the content', async () => {
    const user = userEvent.setup()
    renderTooltip()
    await user.hover(screen.getByRole('button', { name: 'Hover me' }))
    const [content] = await screen.findAllByText('Tooltip text')
    expect(content).toHaveClass('bg-overlay', 'border-border-subtle', 'shadow-elevation-medium')
  })
})
