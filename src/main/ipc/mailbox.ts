import type { AppDatabase } from '@persistence/main'
import { setProviderEnabled } from '@persistence/main'
import {
  addAccount,
  listAccountEmails,
  parseAccounts,
  removeAccount,
  serializeAccounts,
} from '@sources/main'
import type { IpcResult } from '@sources/shared'
import { fail, ok } from '@sources/shared'
import { ipcMain } from 'electron'
import { readProviderConfig, saveProviderConfig } from '../provider-config'

// mailbox:* channels — the multi-account mail connection. Each account (address
// + Gmail App Password) is stored safeStorage-encrypted in the mailbox
// provider_state config; only the addresses ever cross the bridge back to the
// renderer, never the passwords. Same IpcResult convention as db.ts/sources.ts:
// errors are values, never thrown across the bridge.

// Mirrored in src/preload/electron-api.d.ts.
export interface MailboxAccountInfo {
  email: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function toInfos(emails: string[]): MailboxAccountInfo[] {
  return emails.map((email) => ({ email }))
}

export function registerMailboxIpc(db: AppDatabase): void {
  ipcMain.handle('mailbox:list', async (): Promise<IpcResult<MailboxAccountInfo[]>> => {
    try {
      const accounts = parseAccounts(await readProviderConfig(db, 'mailbox'))
      return ok(toInfos(listAccountEmails(accounts)))
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle(
    'mailbox:add',
    async (_event, payload: unknown): Promise<IpcResult<MailboxAccountInfo[]>> => {
      try {
        const { email, appPassword } = (payload ?? {}) as Record<string, unknown>
        if (typeof email !== 'string' || !EMAIL_RE.test(email.trim()))
          return fail('a valid email address is required')
        // App passwords are shown by Google with spaces ("abcd efgh …"); strip
        // all whitespace so either form works for IMAP login.
        const secret = typeof appPassword === 'string' ? appPassword.replace(/\s+/g, '') : ''
        if (secret === '') return fail('an app password is required')
        const accounts = parseAccounts(await readProviderConfig(db, 'mailbox'))
        const next = addAccount(accounts, { email: email.trim(), appPassword: secret })
        await saveProviderConfig(db, 'mailbox', serializeAccounts(next))
        // Adding an inbox is intent to use it — enable the source in one step.
        await setProviderEnabled(db, 'mailbox', true)
        return ok(toInfos(listAccountEmails(next)))
      } catch (error) {
        return fail(error)
      }
    },
  )

  ipcMain.handle(
    'mailbox:remove',
    async (_event, payload: unknown): Promise<IpcResult<MailboxAccountInfo[]>> => {
      try {
        const { email } = (payload ?? {}) as Record<string, unknown>
        if (typeof email !== 'string' || email.trim() === '') return fail('email is required')
        const accounts = parseAccounts(await readProviderConfig(db, 'mailbox'))
        const next = removeAccount(accounts, email)
        // Keep an {accounts:[]} row even when empty so state stays coherent; the
        // provider simply fetches nothing with no accounts.
        await saveProviderConfig(db, 'mailbox', serializeAccounts(next))
        return ok(toInfos(listAccountEmails(next)))
      } catch (error) {
        return fail(error)
      }
    },
  )
}
