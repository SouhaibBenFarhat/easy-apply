import type { AnyRouter } from '@tanstack/react-router'
import { renderHook } from '@test-utils'
import { useAppKeyboard } from './keyboard'

interface FakeRouter {
  navigate: ReturnType<typeof vi.fn>
  history: { back: ReturnType<typeof vi.fn>; forward: ReturnType<typeof vi.fn> }
}

function createFakeRouter(): FakeRouter {
  return {
    navigate: vi.fn(() => Promise.resolve()),
    history: { back: vi.fn(), forward: vi.fn() },
  }
}

function press(key: string, init: KeyboardEventInit = {}): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, metaKey: true, ...init }))
}

describe('useAppKeyboard', () => {
  it('navigates to the matching page on meta+1..4', () => {
    const router = createFakeRouter()
    renderHook(() => useAppKeyboard(router as unknown as AnyRouter))
    press('1')
    press('2')
    press('3')
    press('4')
    expect(router.navigate.mock.calls).toEqual([
      [{ to: '/feed' }],
      [{ to: '/tracker' }],
      [{ to: '/sources' }],
      [{ to: '/settings' }],
    ])
  })

  it('walks history with meta+[ and meta+]', () => {
    const router = createFakeRouter()
    renderHook(() => useAppKeyboard(router as unknown as AnyRouter))
    press('[')
    expect(router.history.back).toHaveBeenCalledTimes(1)
    press(']')
    expect(router.history.forward).toHaveBeenCalledTimes(1)
  })

  it('ignores keys without the meta modifier', () => {
    const router = createFakeRouter()
    renderHook(() => useAppKeyboard(router as unknown as AnyRouter))
    press('1', { metaKey: false })
    expect(router.navigate).not.toHaveBeenCalled()
  })

  it('ignores events while composing text', () => {
    const router = createFakeRouter()
    renderHook(() => useAppKeyboard(router as unknown as AnyRouter))
    press('1', { isComposing: true })
    expect(router.navigate).not.toHaveBeenCalled()
  })

  it('ignores shortcuts typed inside form fields', () => {
    const router = createFakeRouter()
    renderHook(() => useAppKeyboard(router as unknown as AnyRouter))
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '1', metaKey: true, bubbles: true }))
    expect(router.navigate).not.toHaveBeenCalled()
    input.remove()
  })

  it('removes the listener on unmount', () => {
    const router = createFakeRouter()
    const { unmount } = renderHook(() => useAppKeyboard(router as unknown as AnyRouter))
    unmount()
    press('1')
    expect(router.navigate).not.toHaveBeenCalled()
  })
})
