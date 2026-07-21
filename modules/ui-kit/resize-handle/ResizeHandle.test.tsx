import { render, screen, userEvent } from '@test-utils'
import { ResizeHandle } from './ResizeHandle'

function setup(): {
  onResizeStart: ReturnType<typeof vi.fn>
  onResize: ReturnType<typeof vi.fn>
  onResizeEnd: ReturnType<typeof vi.fn>
} {
  const onResizeStart = vi.fn()
  const onResize = vi.fn()
  const onResizeEnd = vi.fn()
  render(
    <ResizeHandle
      aria-label="Resize"
      value={400}
      min={200}
      max={600}
      onResizeStart={onResizeStart}
      onResize={onResize}
      onResizeEnd={onResizeEnd}
    />,
  )
  return { onResizeStart, onResize, onResizeEnd }
}

describe('ResizeHandle', () => {
  it('renders a splitter carrying its aria values', () => {
    setup()
    const handle = screen.getByRole('separator', { name: 'Resize' })
    expect(handle).toHaveAttribute('aria-valuenow', '400')
    expect(handle).toHaveAttribute('aria-valuemin', '200')
    expect(handle).toHaveAttribute('aria-valuemax', '600')
  })

  it('nudges wider on ArrowRight and narrower on ArrowLeft', async () => {
    const { onResizeStart, onResize, onResizeEnd } = setup()
    const user = userEvent.setup()
    screen.getByRole('separator', { name: 'Resize' }).focus()

    await user.keyboard('{ArrowRight}')
    expect(onResizeStart).toHaveBeenCalled()
    expect(onResize).toHaveBeenLastCalledWith(16)
    expect(onResizeEnd).toHaveBeenCalled()

    await user.keyboard('{ArrowLeft}')
    expect(onResize).toHaveBeenLastCalledWith(-16)
  })

  it('takes a bigger step with Shift held', async () => {
    const { onResize } = setup()
    const user = userEvent.setup()
    screen.getByRole('separator', { name: 'Resize' }).focus()

    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(onResize).toHaveBeenLastCalledWith(48)
  })
})
