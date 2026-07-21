import type { SourceInfo, SyncRun } from '@data'
import { act, fireEvent, render, renderHook, screen, userEvent, waitFor } from '@test-utils'
import { dismiss, Toaster, useToast } from '@ui-kit'
import type { ReactElement } from 'react'
import { SourcesPage } from './SourcesPage'

afterEach(() => {
  vi.useRealTimers()
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
      <SourcesPage />
      <Toaster />
    </>
  )
}

// The seeded mock registry order — the page must render it as returned.
const REGISTRY_ORDER = [
  'Arbeitsagentur',
  'Arbeitnow',
  'Himalayas',
  'RemoteOK',
  'WeWorkRemotely',
  'Adzuna',
] as const

async function listSeededSources(): Promise<SourceInfo[]> {
  const result = await window.electron.sources.list()
  if (!result.success) throw new Error(result.error)
  return result.data
}

function makeRun(overrides: Partial<SyncRun> & Pick<SyncRun, 'id' | 'sourceId'>): SyncRun {
  return {
    startedAt: '2026-07-20T10:00:00.000Z',
    finishedAt: '2026-07-20T10:00:05.000Z',
    ok: true,
    error: null,
    inserted: 0,
    updated: 0,
    ...overrides,
  }
}

describe('SourcesPage', () => {
  it('renders one card per source in registry order', async () => {
    render(<Page />)

    expect(
      await screen.findByText("Sources sync sequentially and respect each provider's rate limits."),
    ).toBeInTheDocument()
    const headings = screen.getAllByRole('heading', { level: 3 })
    expect(headings.map((heading) => heading.textContent)).toEqual([...REGISTRY_ORDER])
    expect(screen.getByRole('link', { name: 'Open Adzuna' })).toHaveAttribute(
      'href',
      'https://www.adzuna.de',
    )
    // Nothing has synced yet in the seeded mock — every meta line says so.
    expect(screen.getAllByText(/Never synced/)).toHaveLength(6)
    expect(screen.getByRole('switch', { name: 'Enable Arbeitsagentur' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Enable Adzuna' })).not.toBeChecked()
  })

  it('shows the last sync as relative time once a source has synced', async () => {
    const seeded = await listSeededSources()
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString()
    vi.spyOn(window.electron.sources, 'list').mockResolvedValue({
      success: true,
      data: seeded.map((source) =>
        source.sourceId === 'ba' ? { ...source, lastSyncAt: oneHourAgo } : source,
      ),
    })
    render(<Page />)

    expect(await screen.findByText(/Synced 1 hour ago/)).toBeInTheDocument()
    expect(screen.getAllByText(/Never synced/)).toHaveLength(5)
  })

  it('toggling a switch calls sources.setEnabled', async () => {
    const setEnabled = vi.spyOn(window.electron.sources, 'setEnabled')
    const user = userEvent.setup()
    render(<Page />)

    await user.click(await screen.findByRole('switch', { name: 'Enable Arbeitsagentur' }))

    await waitFor(() => expect(setEnabled).toHaveBeenCalledExactlyOnceWith('ba', false))
  })

  it('renders the key form for adzuna only, gates save on all fields, and toasts', async () => {
    const setKey = vi.spyOn(window.electron.sources, 'setKey')
    const user = userEvent.setup()
    render(<Page />)

    await screen.findByRole('heading', { level: 3, name: 'Adzuna' })
    // The only keyed source in the registry: exactly one key form on the page.
    expect(screen.getAllByRole('button', { name: 'Save key' })).toHaveLength(1)
    expect(
      screen.getByText(
        'Free key from developer.adzuna.com — the only Munich source with salary data.',
      ),
    ).toBeInTheDocument()

    const save = screen.getByRole('button', { name: 'Save key' })
    expect(save).toBeDisabled()
    await user.type(screen.getByLabelText('Application ID'), 'my-app-id')
    expect(save).toBeDisabled()
    await user.type(screen.getByLabelText('Application key'), 'my-app-key')
    expect(save).toBeEnabled()

    await user.click(save)
    await waitFor(() =>
      expect(setKey).toHaveBeenCalledExactlyOnceWith('adzuna', {
        app_id: 'my-app-id',
        app_key: 'my-app-key',
      }),
    )
    expect(await screen.findByText('Key saved — Adzuna enabled')).toBeInTheDocument()
    // setKey enables the source and stores the key; the refetched card
    // collapses the form into the configured row.
    expect(await screen.findByText('API key configured')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save key' })).not.toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Enable Adzuna' })).toBeChecked()
  })

  it('shows a destructive toast when saving the key fails', async () => {
    vi.spyOn(window.electron.sources, 'setKey').mockResolvedValue({
      success: false,
      error: 'safeStorage unavailable',
    })
    const user = userEvent.setup()
    render(<Page />)

    await user.type(await screen.findByLabelText('Application ID'), 'id')
    await user.type(screen.getByLabelText('Application key'), 'key')
    await user.click(screen.getByRole('button', { name: 'Save key' }))

    expect(await screen.findByText('Could not save key')).toBeInTheDocument()
    expect(screen.getByText('safeStorage unavailable')).toBeInTheDocument()
  })

  it('clearing the key requires the armed confirm click', async () => {
    await window.electron.sources.setKey('adzuna', { app_id: 'a', app_key: 'b' })
    const clearKey = vi.spyOn(window.electron.sources, 'clearKey')
    const user = userEvent.setup()
    render(<Page />)

    // First click only arms the confirm — nothing is cleared yet.
    await user.click(await screen.findByRole('button', { name: 'Clear' }))
    expect(clearKey).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Confirm clear' }))
    await waitFor(() => expect(clearKey).toHaveBeenCalledExactlyOnceWith('adzuna'))
    // Key gone → the entry form is back.
    expect(await screen.findByLabelText('Application ID')).toBeInTheDocument()
  })

  it('disarms the clear confirmation after the timeout', async () => {
    await window.electron.sources.setKey('adzuna', { app_id: 'a', app_key: 'b' })
    const clearKey = vi.spyOn(window.electron.sources, 'clearKey')
    render(<Page />)
    await screen.findByRole('button', { name: 'Clear' })

    // Fake timers only from here: the initial load already settled above.
    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByRole('button', { name: 'Confirm clear' })).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
    expect(clearKey).not.toHaveBeenCalled()
  })

  it('replace key toggles the entry form while keeping the configured row', async () => {
    await window.electron.sources.setKey('adzuna', { app_id: 'a', app_key: 'b' })
    const user = userEvent.setup()
    render(<Page />)

    const replace = await screen.findByRole('button', { name: 'Replace key' })
    expect(screen.queryByRole('button', { name: 'Save key' })).not.toBeInTheDocument()
    await user.click(replace)
    expect(screen.getByRole('button', { name: 'Save key' })).toBeInTheDocument()
    expect(screen.getByText('API key configured')).toBeInTheDocument()
    await user.click(replace)
    expect(screen.queryByRole('button', { name: 'Save key' })).not.toBeInTheDocument()
  })

  // Newest-first, like listRecentSyncRuns: ba's latest run failed (long
  // error), himalayas' failed (short error), wwr's failed (no message) —
  // while arbeitnow's latest succeeded despite an older failure.
  function mockFailedRuns(): void {
    vi.spyOn(window.electron.sync, 'status').mockResolvedValue({
      success: true,
      data: {
        running: false,
        lastCompletedAt: '2026-07-20T10:00:05.000Z',
        recentRuns: [
          makeRun({ id: 9, sourceId: 'arbeitnow' }),
          makeRun({ id: 8, sourceId: 'ba', ok: false, error: 'x'.repeat(250) }),
          makeRun({ id: 7, sourceId: 'ba' }),
          makeRun({ id: 6, sourceId: 'arbeitnow', ok: false, error: 'old failure' }),
          makeRun({ id: 5, sourceId: 'himalayas', ok: false, error: 'HTTP 429' }),
          makeRun({ id: 4, sourceId: 'wwr', ok: false, error: null }),
        ],
      },
    })
  }

  it('badges only sources whose latest run failed, with a truncated tooltip', async () => {
    mockFailedRuns()
    const user = userEvent.setup()
    render(<Page />)

    // DOM order matches card order: ba, himalayas, wwr fail; arbeitnow's
    // newest run succeeded so it carries no badge.
    const badges = await screen.findAllByText('last sync failed')
    expect(badges).toHaveLength(3)

    // Long errors are cut to a 200-char preview.
    await user.hover(badges[0] as HTMLElement)
    expect(await screen.findByRole('tooltip')).toHaveTextContent(`${'x'.repeat(200)}…`)
  })

  it('shows a short sync error untruncated', async () => {
    mockFailedRuns()
    const user = userEvent.setup()
    render(<Page />)

    const badges = await screen.findAllByText('last sync failed')
    await user.hover(badges[1] as HTMLElement)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('HTTP 429')
  })

  it('falls back to "Unknown error" when the failed run has no message', async () => {
    mockFailedRuns()
    const user = userEvent.setup()
    render(<Page />)

    const badges = await screen.findAllByText('last sync failed')
    await user.hover(badges[2] as HTMLElement)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Unknown error')
  })

  it('shows the skeleton while sources load slowly', async () => {
    vi.spyOn(window.electron.sources, 'list').mockReturnValue(new Promise(() => {}))
    render(<Page />)

    expect(await screen.findByRole('status', { name: 'Loading sources' })).toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('surfaces a query error with a working retry', async () => {
    vi.spyOn(window.electron.sources, 'list').mockResolvedValueOnce({
      success: false,
      error: 'bridge exploded',
    })
    const user = userEvent.setup()
    render(<Page />)

    expect(await screen.findByText('Could not load sources')).toBeInTheDocument()
    expect(screen.getByText('bridge exploded')).toBeInTheDocument()

    // The once-mock is consumed — retry falls through to the real mock list.
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(
      await screen.findByRole('heading', { level: 3, name: 'Arbeitsagentur' }),
    ).toBeInTheDocument()
  })
})
