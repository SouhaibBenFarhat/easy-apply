import type { UseMutationResult } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { MailboxAccountInfo } from '../../../src/preload/electron-api'
import { unwrap } from '../ipc'
import { keys } from '../keys'

export interface AddMailboxAccountVariables {
  email: string
  appPassword: string
}

// Both mutations return the full updated account list from the bridge and
// refresh it, plus the sources list (adding an account enables the source).
export function useAddMailboxAccount(): UseMutationResult<
  MailboxAccountInfo[],
  Error,
  AddMailboxAccountVariables
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ email, appPassword }: AddMailboxAccountVariables) =>
      unwrap(await window.electron.mailbox.add(email, appPassword)),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: keys.mailbox.accounts }),
        client.invalidateQueries({ queryKey: keys.sources.list }),
      ])
    },
  })
}

export function useRemoveMailboxAccount(): UseMutationResult<MailboxAccountInfo[], Error, string> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (email: string) => unwrap(await window.electron.mailbox.remove(email)),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: keys.mailbox.accounts }),
        client.invalidateQueries({ queryKey: keys.sources.list }),
      ])
    },
  })
}
