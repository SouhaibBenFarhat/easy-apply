import type { UseQueryResult } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import type { MailboxAccountInfo } from '../../../src/preload/electron-api'
import { unwrap } from '../ipc'
import { keys } from '../keys'

// The connected mail accounts (addresses only — the App Passwords never cross
// the bridge). Drives the Job-alert inbox card's list.
export function useMailboxAccounts(): UseQueryResult<MailboxAccountInfo[], Error> {
  return useQuery({
    queryKey: keys.mailbox.accounts,
    queryFn: async () => unwrap(await window.electron.mailbox.list()),
  })
}
