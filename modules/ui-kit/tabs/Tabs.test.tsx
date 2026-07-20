import { render, screen, userEvent } from '@test-utils'

import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs'

function renderTabs(): void {
  render(
    <Tabs defaultValue="one">
      <TabsList>
        <TabsTrigger value="one">One</TabsTrigger>
        <TabsTrigger value="two">Two</TabsTrigger>
      </TabsList>
      <TabsContent value="one">First panel</TabsContent>
      <TabsContent value="two">Second panel</TabsContent>
    </Tabs>,
  )
}

describe('Tabs', () => {
  it('renders triggers and shows the default tab content', () => {
    renderTabs()
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('data-state', 'active')
    expect(screen.getByText('First panel')).toBeInTheDocument()
    expect(screen.queryByText('Second panel')).not.toBeInTheDocument()
  })

  it('switches content when another trigger is clicked', async () => {
    renderTabs()
    await userEvent.click(screen.getByRole('tab', { name: 'Two' }))
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('data-state', 'active')
    expect(screen.getByText('Second panel')).toBeInTheDocument()
  })

  it('renders triggers as type="button"', () => {
    renderTabs()
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('type', 'button')
  })
})
