import { render, screen } from '@test-utils'
import { ScrollArea } from './ScrollArea'

describe('ScrollArea', () => {
  it('renders its children inside the viewport', () => {
    render(
      <ScrollArea>
        <p>Scrollable content</p>
      </ScrollArea>,
    )
    expect(screen.getByText('Scrollable content')).toBeInTheDocument()
  })

  it('applies the base layout classes on the root', () => {
    const { container } = render(<ScrollArea data-testid="area">content</ScrollArea>)
    const root = container.firstElementChild
    expect(root).toHaveClass('relative', 'overflow-hidden')
  })

  it('merges a custom className on the root', () => {
    const { container } = render(<ScrollArea className="h-64">content</ScrollArea>)
    expect(container.firstElementChild).toHaveClass('h-64', 'relative', 'overflow-hidden')
  })

  it('renders a viewport that inherits the border radius', () => {
    const { container } = render(<ScrollArea>content</ScrollArea>)
    const viewport = container.querySelector('[data-radix-scroll-area-viewport]')
    expect(viewport).toHaveClass('h-full', 'w-full', 'rounded-[inherit]')
  })

  it('forwards arbitrary props to the root element', () => {
    render(<ScrollArea data-testid="scroll-root">content</ScrollArea>)
    expect(screen.getByTestId('scroll-root')).toBeInTheDocument()
  })

  it('exposes the scrollable viewport through viewportRef', () => {
    const ref = { current: null as HTMLDivElement | null }
    const { container } = render(<ScrollArea viewportRef={ref}>content</ScrollArea>)
    expect(ref.current).toBe(container.querySelector('[data-radix-scroll-area-viewport]'))
  })
})
