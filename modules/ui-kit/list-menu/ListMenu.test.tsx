import { render, screen, userEvent } from '@test-utils'
import { ListMenu, ListMenuGroupLabel, ListMenuItem, ListMenuSeparator } from './ListMenu'

describe('ListMenu', () => {
  it('renders a menu with menuitem buttons of type="button"', () => {
    render(
      <ListMenu>
        <ListMenuItem>Munich</ListMenuItem>
        <ListMenuItem>Remote EU</ListMenuItem>
      </ListMenu>,
    )
    expect(screen.getByRole('menu')).toBeInTheDocument()
    const items = screen.getAllByRole('menuitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveAttribute('type', 'button')
  })

  it('marks the selected item via data-selected', () => {
    render(
      <ListMenu>
        <ListMenuItem selected>Munich</ListMenuItem>
        <ListMenuItem>Remote EU</ListMenuItem>
      </ListMenu>,
    )
    expect(screen.getByRole('menuitem', { name: 'Munich' })).toHaveAttribute(
      'data-selected',
      'true',
    )
    expect(screen.getByRole('menuitem', { name: 'Remote EU' })).not.toHaveAttribute(
      'data-selected',
      'true',
    )
  })

  it('renders description and trailing content', () => {
    render(
      <ListMenu>
        <ListMenuItem description="Jobs in Bavaria" trailing={<span>12</span>}>
          Munich
        </ListMenuItem>
      </ListMenu>,
    )
    const item = screen.getByRole('menuitem')
    expect(item).toHaveTextContent('Munich')
    expect(screen.getByText('Jobs in Bavaria')).toHaveClass('text-xs', 'text-foreground-muted')
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('calls onClick when an item is clicked', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <ListMenu>
        <ListMenuItem onClick={onClick}>Munich</ListMenuItem>
      </ListMenu>,
    )
    await user.click(screen.getByRole('menuitem', { name: 'Munich' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders group label and separator', () => {
    render(
      <ListMenu>
        <ListMenuGroupLabel>Locations</ListMenuGroupLabel>
        <ListMenuSeparator data-testid="separator" />
      </ListMenu>,
    )
    expect(screen.getByText('Locations')).toHaveClass('label-caps')
    expect(screen.getByTestId('separator')).toHaveClass('h-px', 'bg-border-muted')
  })
})
