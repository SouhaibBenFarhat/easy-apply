import { THEME_STORAGE_KEY } from '@data'
import { act, fireEvent, renderHook, screen, userEvent, waitFor } from '@test-utils'
import { render } from '@testing-library/react'
import { dismiss, useToast } from '@ui-kit'
import { App } from './App'

// App brings its own QueryClientProvider + router — render it bare, without
// the test-utils provider wrapper.

afterEach(() => {
  const { result } = renderHook(() => useToast())
  act(() => {
    for (const item of [...result.current.toasts]) {
      dismiss(item.id)
    }
  })
})

function pressMeta(key: string): void {
  fireEvent.keyDown(window, { key, metaKey: true })
}

describe('App', () => {
  it('renders the sidebar nav and lands on the feed', async () => {
    render(<App />)
    expect(await screen.findByText('No jobs yet')).toBeInTheDocument()
    for (const name of ['Feed', 'Tracker', 'Sources', 'Settings']) {
      expect(screen.getByRole('menuitem', { name })).toBeInTheDocument()
    }
    expect(screen.getByRole('heading', { level: 1, name: 'Feed' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Feed' })).toHaveAttribute('data-selected', 'true')
  })

  it('meta+2..4 switch pages and update the header title', async () => {
    render(<App />)
    await screen.findByText('No jobs yet')

    pressMeta('2')
    expect(await screen.findByText('Tracker lands in PR 13.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Tracker' })).toBeInTheDocument()

    pressMeta('3')
    expect(await screen.findByText('Sources lands in PR 14.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Sources' })).toBeInTheDocument()
  })

  it('meta+[ walks back through history', async () => {
    render(<App />)
    await screen.findByText('No jobs yet')
    pressMeta('2')
    await screen.findByText('Tracker lands in PR 13.')

    pressMeta('[')
    expect(await screen.findByText('No jobs yet')).toBeInTheDocument()
    pressMeta(']')
    expect(await screen.findByText('Tracker lands in PR 13.')).toBeInTheDocument()
  })

  it('sidebar navigation opens the settings page', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('No jobs yet')

    await user.click(screen.getByRole('menuitem', { name: 'Settings' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
    expect(await screen.findByDisplayValue('München')).toBeInTheDocument()
  })

  it('the header sync button triggers window.electron.sync.now', async () => {
    const now = vi.spyOn(window.electron.sync, 'now')
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('No jobs yet')

    await user.click(screen.getByRole('button', { name: 'Sync now' }))
    await waitFor(() => expect(now).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Sync complete')).toBeInTheDocument()
  })

  it('the theme toggle cycles dark → light', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('No jobs yet')

    await user.click(screen.getByRole('button', { name: 'Toggle theme' }))
    await waitFor(() => expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light'))
  })
})
