import type { MailAccount, MailDriver, MailMessage, MailSearchQuery } from '@sources/main'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'

// Real IMAP driver (imapflow + mailparser) behind the MailDriver seam. Electron
// glue — coverage-excluded; the read/filter logic that consumes it
// (readAlertMessages) is unit-tested against a fake. Not exercised in CI or my
// sandbox — verified on-device against a real inbox.

export function createImapMailDriver(account: MailAccount): MailDriver {
  const client = new ImapFlow({
    host: account.host,
    port: account.port,
    secure: account.secure,
    auth: { user: account.user, pass: account.password },
    logger: false,
  })

  return {
    connect: async (): Promise<void> => {
      await client.connect()
    },
    search: async (query: MailSearchQuery): Promise<MailMessage[]> => {
      const messages: MailMessage[] = []
      const lock = await client.getMailboxLock(query.mailbox)
      try {
        for await (const message of client.fetch({ since: query.since }, { source: true })) {
          const source = message.source
          if (source === undefined) continue
          const parsed = await simpleParser(source)
          messages.push({
            uid: message.uid,
            from: parsed.from?.text ?? '',
            subject: parsed.subject ?? '',
            date: (parsed.date ?? new Date()).toISOString(),
            html: typeof parsed.html === 'string' ? parsed.html : null,
            text: parsed.text ?? null,
          })
        }
      } finally {
        lock.release()
      }
      return messages
    },
    close: async (): Promise<void> => {
      await client.logout()
    },
  }
}
