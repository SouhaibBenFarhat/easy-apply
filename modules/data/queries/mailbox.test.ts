import { renderHook, waitFor } from '@test-utils'
import { useMailboxAccounts } from './mailbox'

describe('useMailboxAccounts', () => {
  it('lists the connected accounts from the bridge', async () => {
    await window.electron.mailbox.add('one@gmail.com', 'pw')
    await window.electron.mailbox.add('two@gmail.com', 'pw')

    const { result } = renderHook(() => useMailboxAccounts())
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.map((account) => account.email)).toEqual([
      'one@gmail.com',
      'two@gmail.com',
    ])
  })

  it('surfaces an IpcResult failure as a query error', async () => {
    vi.spyOn(window.electron.mailbox, 'list').mockResolvedValue({
      success: false,
      error: 'mailbox unavailable',
    })
    const { result } = renderHook(() => useMailboxAccounts())
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('mailbox unavailable')
  })
})
