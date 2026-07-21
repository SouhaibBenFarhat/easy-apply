import type { NormalizedJob, SourceId } from '@sources/shared'
import type { MailAccount, MailMessage } from '../mail'
import { readAlertMessages } from '../mail'
import { extractJobsFromEmail } from '../mail-extract'
import { type MailboxAccount, parseAccounts } from '../mailbox-accounts'
import type { FetchContext, JobSourceProvider, ProviderMeta, RawPayload } from '../types'

// Email job-alert ingestion — reads the user's own inbox(es) over IMAP and
// turns LinkedIn / Indeed / StepStone / Xing alert emails into feed jobs via
// the on-device LLM. This is the ONE credentialed mail connection; the jobs it
// emits are tagged with their board's sourceId (linkedin/indeed/…) so feed
// chips and cross-source dedupe work naturally. Credentials (address + App
// Password) are stored safeStorage-encrypted through the standard key flow.
//
// The provider contract's parse() is synchronous, but IMAP + LLM extraction are
// async — so fetch() does all the work and serializes the finished jobs into a
// single payload, and parse() just deserializes it.

const MAILBOX = 'INBOX'
const LOOKBACK_DAYS = 30

const meta: ProviderMeta = {
  id: 'mailbox',
  displayName: 'Job-alert inbox',
  homepage: 'https://mail.google.com',
  enabledByDefault: false, // turns on when the user connects their inbox
  requiresKey: {
    fields: [
      { id: 'email', label: 'Gmail address', hint: 'you@gmail.com', secret: false },
      { id: 'app_password', label: 'App password', hint: 'paste the 16-character code' },
    ],
  },
  attribution: { label: 'Your inbox', required: false },
  politeness: { minIntervalMinutes: 30, maxRequestsPerSync: 1 },
}

// Sender fragment → the board sourceId its alert emails belong to.
const SENDER_SOURCES: ReadonlyArray<{ pattern: string; sourceId: SourceId }> = [
  { pattern: 'linkedin.com', sourceId: 'linkedin' },
  { pattern: 'indeed.com', sourceId: 'indeed' },
  { pattern: 'stepstone', sourceId: 'stepstone' },
  { pattern: 'xing.com', sourceId: 'xing' },
]

function sourceForSender(from: string): SourceId | null {
  const lower = from.toLowerCase()
  for (const { pattern, sourceId } of SENDER_SOURCES) if (lower.includes(pattern)) return sourceId
  return null
}

// Gmail IMAP connection for a stored account. Host/port are fixed; the App
// Password is the IMAP password.
function toMailAccount(account: MailboxAccount): MailAccount {
  return {
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    user: account.email,
    password: account.appPassword,
  }
}

export const mailboxProvider: JobSourceProvider = {
  meta,

  async fetch(ctx: FetchContext): Promise<RawPayload[]> {
    const accounts = parseAccounts(ctx.config)
    if (accounts.length === 0) {
      ctx.logger.debug('mailbox: no inbox connected — skipping')
      return []
    }
    // The mail + LLM runtime is injected by the engine; absent (e.g. the model
    // isn't installed yet) means the feature can't run — skip quietly.
    const { createMail, llm } = ctx
    if (createMail === undefined || llm === undefined) {
      ctx.logger.debug('mailbox: mail/LLM runtime unavailable — skipping')
      ctx.trace?.({ channel: 'mailbox', label: 'Skipped — model not installed' })
      return []
    }

    const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000)
    const senderPatterns = SENDER_SOURCES.map((entry) => entry.pattern)
    const jobs: NormalizedJob[] = []

    for (const account of accounts) {
      let messages: MailMessage[]
      try {
        ctx.trace?.({ channel: 'mailbox', label: 'Connecting to an inbox…' })
        messages = await readAlertMessages(createMail(toMailAccount(account)), {
          mailbox: MAILBOX,
          senderPatterns,
          since,
        })
        ctx.trace?.({ channel: 'mailbox', label: `Found ${messages.length} alert email(s)` })
      } catch (error) {
        // One inbox failing (bad password, IMAP hiccup) never sinks the rest.
        const message = error instanceof Error ? error.message : String(error)
        ctx.logger.error(`mailbox: read failed for an account — ${message}`)
        ctx.trace?.({ channel: 'mailbox', label: 'Inbox read failed', body: message })
        continue
      }
      for (const message of messages) {
        const sourceId = sourceForSender(message.from)
        if (sourceId === null) continue
        const extracted = await extractJobsFromEmail(message, sourceId, llm)
        ctx.trace?.({
          channel: 'mailbox',
          label: `${sourceId}: ${extracted.length} job(s) from "${message.subject}"`,
        })
        jobs.push(...extracted)
      }
    }

    ctx.logger.info(`mailbox: extracted ${jobs.length} jobs from ${accounts.length} inbox(es)`)
    ctx.trace?.({ channel: 'mailbox', label: `Done — ${jobs.length} job(s) total` })
    return [{ kind: 'jobs', body: JSON.stringify(jobs) }]
  },

  // fetch already produced normalized jobs; parse just deserializes them.
  parse(raw: RawPayload): NormalizedJob[] {
    try {
      const parsed: unknown = JSON.parse(raw.body)
      return Array.isArray(parsed) ? (parsed as NormalizedJob[]) : []
    } catch {
      return []
    }
  },
}
