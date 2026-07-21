import { THEME_STORAGE_KEY } from '@data'
import { act, render, renderHook, screen, userEvent, waitFor } from '@test-utils'
import { dismiss, Toaster, useToast } from '@ui-kit'
import type { ReactElement } from 'react'
import { SettingsPage } from './SettingsPage'

// happy-dom lacks pointer-capture and scrollIntoView APIs that Radix Select
// relies on (same shim as the ui-kit Select tests).
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  const { result } = renderHook(() => useToast())
  act(() => {
    for (const item of [...result.current.toasts]) {
      dismiss(item.id)
    }
  })
})

function Page(): ReactElement {
  return (
    <>
      <SettingsPage />
      <Toaster />
    </>
  )
}

describe('SettingsPage', () => {
  it('seeds the form from the stored settings', async () => {
    render(<Page />)
    expect(await screen.findByDisplayValue('München')).toBeInTheDocument()
    expect(screen.getByLabelText('Radius (km)')).toHaveValue(25)
    expect(screen.getByLabelText('Keywords')).toHaveValue('software')
    for (const name of ['Germany', 'Europe', 'Worldwide']) {
      expect(screen.getByRole('switch', { name })).toBeChecked()
    }
    expect(screen.getByRole('combobox', { name: 'Sync interval' })).toHaveTextContent(
      'Every 3 hours',
    )
  })

  it('saves the edited profile with parsed keywords and toasts', async () => {
    const set = vi.spyOn(window.electron.settings, 'set')
    const user = userEvent.setup()
    render(<Page />)

    const city = await screen.findByLabelText('City')
    await user.clear(city)
    await user.type(city, 'Berlin')
    const keywords = screen.getByLabelText('Keywords')
    await user.clear(keywords)
    await user.type(keywords, ' react,  node.js, , go ')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(set).toHaveBeenCalledWith({
        searchProfile: {
          city: 'Berlin',
          radiusKm: 25,
          keywords: ['react', 'node.js', 'go'],
          remoteScopes: ['germany', 'europe', 'worldwide'],
        },
      }),
    )
    expect(await screen.findByText('Settings saved')).toBeInTheDocument()
  })

  it('clamps an out-of-range radius before saving', async () => {
    const set = vi.spyOn(window.electron.settings, 'set')
    const user = userEvent.setup()
    render(<Page />)

    const radius = await screen.findByLabelText('Radius (km)')
    await user.clear(radius)
    await user.type(radius, '999')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(set).toHaveBeenCalled())
    const update = set.mock.calls[0]?.[0]
    expect(update?.searchProfile?.radiusKm).toBe(200)
  })

  it('toggles a remote scope off and saves without it', async () => {
    const set = vi.spyOn(window.electron.settings, 'set')
    const user = userEvent.setup()
    render(<Page />)

    const germany = await screen.findByRole('switch', { name: 'Germany' })
    await user.click(germany)
    expect(germany).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(set).toHaveBeenCalled())
    expect(set.mock.calls[0]?.[0]?.searchProfile?.remoteScopes).toEqual(['europe', 'worldwide'])
  })

  it('saves the sync interval immediately on change', async () => {
    const set = vi.spyOn(window.electron.settings, 'set')
    const user = userEvent.setup()
    render(<Page />)

    await user.click(await screen.findByRole('combobox', { name: 'Sync interval' }))
    await user.click(await screen.findByRole('option', { name: 'Every 6 hours' }))

    await waitFor(() => expect(set).toHaveBeenCalledExactlyOnceWith({ syncIntervalHours: 6 }))
    expect(await screen.findByText('Settings saved')).toBeInTheDocument()
  })

  it('changes the theme from the appearance card', async () => {
    const user = userEvent.setup()
    render(<Page />)

    await user.click(await screen.findByRole('combobox', { name: 'Theme' }))
    await user.click(await screen.findByRole('option', { name: 'Light' }))

    await waitFor(() => expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light'))
    expect(screen.getByRole('combobox', { name: 'Theme' })).toHaveTextContent('Light')
  })

  it('shows the skeleton while settings load slowly', async () => {
    vi.spyOn(window.electron.settings, 'get').mockReturnValue(new Promise(() => {}))
    render(<Page />)

    expect(await screen.findByRole('status', { name: 'Loading settings' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('shows a destructive toast when saving fails', async () => {
    vi.spyOn(window.electron.settings, 'set').mockResolvedValue({
      success: false,
      error: 'radiusKm: too large',
    })
    const user = userEvent.setup()
    render(<Page />)

    await user.click(await screen.findByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Could not save settings')).toBeInTheDocument()
    expect(screen.getByText('radiusKm: too large')).toBeInTheDocument()
  })
})
