import { act, render, renderHook, screen, userEvent } from '@test-utils'

import { Toaster } from './Toast'
import { dismiss, toast, useToast } from './use-toast'

afterEach(() => {
  const { result } = renderHook(() => useToast())
  act(() => {
    for (const item of [...result.current.toasts]) {
      dismiss(item.id)
    }
  })
  vi.useRealTimers()
})

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('adds a toast with a generated id', () => {
    const { result } = renderHook(() => useToast())
    let id = ''
    act(() => {
      id = toast({ title: 'Saved', description: 'All good' })
    })
    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0]).toMatchObject({ id, title: 'Saved', description: 'All good' })
  })

  it('auto-dismisses a toast after 5000ms', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      toast({ title: 'Temporary' })
    })
    act(() => {
      vi.advanceTimersByTime(4999)
    })
    expect(result.current.toasts).toHaveLength(1)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.toasts).toHaveLength(0)
  })

  it('dismiss removes a toast immediately', () => {
    const { result } = renderHook(() => useToast())
    let id = ''
    act(() => {
      id = toast({ title: 'Gone' })
    })
    act(() => {
      dismiss(id)
    })
    expect(result.current.toasts).toHaveLength(0)
  })
})

describe('Toaster', () => {
  it('renders an open toast with title and description', () => {
    render(<Toaster />)
    act(() => {
      toast({ title: 'Job saved', description: 'Added to your list' })
    })
    expect(screen.getByText('Job saved')).toBeInTheDocument()
    expect(screen.getByText('Added to your list')).toBeInTheDocument()
  })

  it('applies destructive styling for the destructive variant', () => {
    render(<Toaster />)
    act(() => {
      toast({ title: 'Failed', variant: 'destructive' })
    })
    const root = screen.getByText('Failed').closest('li')
    expect(root).toHaveClass('border-destructive-border', 'text-destructive', 'glass-overlay')
  })

  it('removes the toast when the close button is clicked', async () => {
    const user = userEvent.setup()
    render(<Toaster />)
    act(() => {
      toast({ title: 'Dismiss me' })
    })
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument()
  })
})
