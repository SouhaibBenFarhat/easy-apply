import { createLogger } from '@logger/main'
import type {
  MailAccount,
  MailDriver,
  MailEnvelope,
  MailFetchRequest,
  MailMessage,
  MailSearchQuery,
} from '@sources/main'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'

// Real IMAP driver (imapflow + mailparser) behind the MailDriver seam. Electron
// glue — coverage-excluded; the read logic that consumes it (readRecentMessages)
// is unit-tested against a fake. Not exercised in CI or my sandbox — verified
// on-device against a real inbox.

const logger = createLogger('source')

// Gmail files EVERY message — including mail sorted into a label by a filter —
// under the `\All` special-use folder ("All Mail"). Reading that instead of
// just INBOX means job alerts the user filters into a label aren't missed. The
// name is locale-dependent ([Gmail]/All Mail vs /Alle Nachrichten, …), so we
// resolve it by special-use flag. Falls back to the requested mailbox on any
// error, so a non-Gmail or odd server still works.
async function resolveMailboxPath(client: ImapFlow, fallback: string): Promise<string> {
  try {
    for (const box of await client.list()) {
      if (box.specialUse === '\\All') return box.path
    }
  } catch (error) {
    logger.warn(`could not list mailboxes, using ${fallback}: ${String(error)}`)
  }
  return fallback
}

export function createImapMailDriver(account: MailAccount): MailDriver {
  const client = new ImapFlow({
    host: account.host,
    port: account.port,
    secure: account.secure,
    auth: { user: account.user, pass: account.password },
    logger: false,
    // Large mailboxes need room; a too-aggressive socket timeout was surfacing
    // as a 'Socket timeout' error and crashing the main process.
    greetingTimeout: 20_000,
    socketTimeout: 120_000,
  })

  // CRITICAL: imapflow extends EventEmitter and emits 'error' on socket/protocol
  // failures (e.g. a late idle 'Socket timeout'). Without a listener, Node
  // rethrows it as an uncaught exception that crashes the whole main process.
  // Every read/close path already treats failures as values, so just log here.
  client.on('error', (error: unknown) => {
    logger.warn(`imap client error: ${error instanceof Error ? error.message : String(error)}`)
  })

  return {
    connect: async (): Promise<void> => {
      await client.connect()
    },
    // Phase 1: headers only. `envelope` is a parsed header record — no body,
    // no attachments, no inline images cross the wire, which is what makes a
    // 30-day window cost seconds instead of ~100 s.
    listEnvelopes: async (query: MailSearchQuery): Promise<MailEnvelope[]> => {
      const envelopes: MailEnvelope[] = []
      // Prefer Gmail's All Mail so filtered/labeled alerts are included.
      const path = await resolveMailboxPath(client, query.mailbox)
      const lock = await client.getMailboxLock(path)
      try {
        for await (const message of client.fetch({ since: query.since }, { envelope: true })) {
          const envelope = message.envelope
          if (envelope === undefined) continue
          const sender = envelope.from?.[0]
          envelopes.push({
            uid: message.uid,
            // imapflow splits the address; rebuild the "Name <addr>" form the
            // rest of the pipeline (and the funnel's sender line) expects.
            from:
              sender === undefined
                ? ''
                : sender.name
                  ? `${sender.name} <${sender.address ?? ''}>`
                  : (sender.address ?? ''),
            subject: envelope.subject ?? '',
            date: (envelope.date ?? new Date()).toISOString(),
            messageId: envelope.messageId ?? null,
          })
        }
      } finally {
        lock.release()
      }
      return envelopes
    },

    // Phase 2: full source for an explicit UID set — only the messages the
    // caller actually intends to scan.
    fetchMessages: async (request: MailFetchRequest): Promise<MailMessage[]> => {
      const messages: MailMessage[] = []
      const path = await resolveMailboxPath(client, request.mailbox)
      const lock = await client.getMailboxLock(path)
      try {
        for await (const message of client.fetch(
          request.uids.join(','),
          { source: true },
          { uid: true },
        )) {
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
            messageId: parsed.messageId ?? null,
          })
        }
      } finally {
        lock.release()
      }
      return messages
    },
    close: async (): Promise<void> => {
      try {
        await client.logout()
      } catch {
        // The socket may already be dead (timeout) — force it closed and move on.
        client.close()
      }
    },
  }
}
