import { fireEvent, render, screen, userEvent } from '@test-utils'
import { ResizeHandle } from './ResizeHandle'

// happy-dom has no pointer-capture implementation — stub the trio the handle
// uses so a drag can be driven end to end.
function stubPointerCapture(element: HTMLElement): void {
  let captured = false
  element.setPointerCapture = (): void => {
    captured = true
  }
  element.releasePointerCapture = (): void => {
    captured = false
  }
  element.hasPointerCapture = (): boolean => captured
}

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

  it('reports the drag delta across pointer down → move → up', () => {
    const { onResizeStart, onResize, onResizeEnd } = setup()
    const handle = screen.getByRole('separator', { name: 'Resize' })
    stubPointerCapture(handle)

    fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 })
    expect(onResizeStart).toHaveBeenCalledTimes(1)
    expect(document.body.style.cursor).toBe('col-resize')

    fireEvent.pointerMove(handle, { clientX: 140, pointerId: 1 })
    expect(onResize).toHaveBeenLastCalledWith(40)
    fireEvent.pointerMove(handle, { clientX: 70, pointerId: 1 })
    expect(onResize).toHaveBeenLastCalledWith(-30)

    fireEvent.pointerUp(handle, { clientX: 70, pointerId: 1 })
    expect(onResizeEnd).toHaveBeenCalledTimes(1)
    // The drag styles are restored on release.
    expect(document.body.style.cursor).toBe('')
  })

  it('ignores pointer moves that are not part of a drag', () => {
    const { onResize } = setup()
    const handle = screen.getByRole('separator', { name: 'Resize' })
    stubPointerCapture(handle)

    fireEvent.pointerMove(handle, { clientX: 200, pointerId: 1 })
    expect(onResize).not.toHaveBeenCalled()
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
