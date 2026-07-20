import { fail, ok } from './ipc'

describe('IpcResult helpers', () => {
  it('wraps data in a success result', () => {
    expect(ok({ id: 1 })).toEqual({ success: true, data: { id: 1 } })
  })

  it('unwraps Error messages in a failure result', () => {
    expect(fail(new Error('boom'))).toEqual({ success: false, error: 'boom' })
  })

  it('stringifies non-Error failures', () => {
    expect(fail('nope')).toEqual({ success: false, error: 'nope' })
    expect(fail(42)).toEqual({ success: false, error: '42' })
  })
})
