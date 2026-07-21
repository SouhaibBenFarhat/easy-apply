import { renderHook, waitFor } from '@test-utils'
import { useAddMailboxAccount, useRemoveMailboxAccount } from './mailbox'

describe('useAddMailboxAccount', () => {
  it('adds an account and resolves the updated list', async () => {
    const { result } = renderHook(() => useAddMailboxAccount())
    result.current.mutate({ email: 'one@gmail.com', appPassword: 'pw' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.map((account) => account.email)).toEqual(['one@gmail.com'])
  })

  it('surfaces an IpcResult failure as a mutation error', async () => {
    vi.spyOn(window.electron.mailbox, 'add').mockResolvedValue({
      success: false,
      error: 'invalid address',
    })
    const { result } = renderHook(() => useAddMailboxAccount())
    result.current.mutate({ email: 'nope', appPassword: 'pw' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('invalid address')
  })
})

describe('useRemoveMailboxAccount', () => {
  it('removes an account and resolves the remaining list', async () => {
    await window.electron.mailbox.add('one@gmail.com', 'pw')
    await window.electron.mailbox.add('two@gmail.com', 'pw')

    const { result } = renderHook(() => useRemoveMailboxAccount())
    result.current.mutate('one@gmail.com')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.map((account) => account.email)).toEqual(['two@gmail.com'])
  })
})
