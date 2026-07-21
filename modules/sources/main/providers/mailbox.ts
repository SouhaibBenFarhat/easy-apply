import type { NormalizedJob } from '@sources/shared'
import type { MailAccount, MailMessage } from '../mail'
import { readRecentMessages } from '../mail'
import { extractJobsFromEmail } from '../mail-extract'
import { type MailboxAccount, parseAccounts } from '../mailbox-accounts'
import type {
  AgentPipelineStats,
  FetchContext,
  JobSourceProvider,
  ProviderMeta,
  RawPayload,
  TraceFn,
} from '../types'

// Email job ingestion — reads the user's own inbox(es) over IMAP and hands
// EVERY recent email to the on-device LLM, which decides what holds job
// postings and extracts them ("read everything" mode). The board a job belongs
// to is inferred from its apply link, so any sender works. This is the ONE
// credentialed mail connection; credentials (address + App Password) are stored
// safeStorage-encrypted through the standard key flow.
//
// fetch() emits live 'pipeline' trace events (funnel counts) so the header
// monitor can show emails scanned/accepted/rejected and jobs found in real
// time. The contract's parse() is synchronous, so fetch() does all the async
// work and serializes the finished jobs into one payload.

const MAILBOX = 'INBOX'
const LOOKBACK_DAYS = 30
// A local 8B model spends seconds per email, so a large inbox is bounded per
// run. The cap is surfaced in the funnel (`capped`) — never a silent truncation.
const MAX_EMAILS_PER_RUN = 200

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

// Emit a 'pipeline' trace carrying a fresh snapshot of the funnel counts.
function emitStats(trace: TraceFn | undefined, label: string, stats: AgentPipelineStats): void {
  trace?.({ channel: 'pipeline', label, stats: { ...stats } })
}

// Trim a subject to a single-line trace label.
function clip(text: string, max = 48): string {
  const trimmed = text.trim()
  if (trimmed === '') return '(no subject)'
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed
}

// Deep link to the exact message in Gmail via its RFC822 Message-ID (Gmail's
// `rfc822msgid:` search opens the single matching mail). Null when the header is
// missing. The `/u/` path MUST be a numeric index (`/u/0/`) — an email address
// there 404s — so the account is targeted with the `authuser` query instead.
function gmailLink(accountEmail: string, messageId: string | null): string | null {
  if (messageId === null || messageId.trim() === '') return null
  const id = messageId.replace(/^<+|>+$/g, '')
  const query = encodeURIComponent(`rfc822msgid:${id}`)
  const authuser = encodeURIComponent(accountEmail)
  return `https://mail.google.com/mail/u/0/?authuser=${authuser}#search/${query}`
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
    const jobs: NormalizedJob[] = []

    // Gather every recent message across all connected inboxes first, so the
    // funnel can announce the true total before the (slow) extraction starts.
    // Each message keeps its account so we can deep-link the right Gmail inbox.
    const collected: Array<{ message: MailMessage; accountEmail: string }> = []
    for (const account of accounts) {
      try {
        ctx.trace?.({ channel: 'mailbox', label: 'Connecting to an inbox…' })
        const messages = await readRecentMessages(createMail(toMailAccount(account)), {
          mailbox: MAILBOX,
          since,
        })
        ctx.trace?.({ channel: 'mailbox', label: `Found ${messages.length} email(s)` })
        collected.push(...messages.map((message) => ({ message, accountEmail: account.email })))
      } catch (error) {
        // One inbox failing (bad password, IMAP hiccup) never sinks the rest.
        const message = error instanceof Error ? error.message : String(error)
        ctx.logger.error(`mailbox: read failed for an account — ${message}`)
        ctx.trace?.({ channel: 'mailbox', label: 'Inbox read failed', body: message })
      }
    }

    // Only scan NEW mail: drop anything already processed in a past sync, and
    // take the most-recent first so the per-run cap keeps the freshest alerts.
    const seen = ctx.processedMessages
    const fresh = collected
      .filter(
        ({ message }) =>
          message.messageId === null || seen === undefined || !seen.has(message.messageId),
      )
      .sort((a, b) => Date.parse(b.message.date) - Date.parse(a.message.date))

    const capped = fresh.length > MAX_EMAILS_PER_RUN
    const toScan = fresh.slice(0, MAX_EMAILS_PER_RUN)
    const stats: AgentPipelineStats = {
      emailsTotal: toScan.length,
      emailsProcessed: 0,
      emailsAccepted: 0,
      emailsRejected: 0,
      jobsProposed: 0,
      jobsKept: 0,
      capped,
      done: false,
      paused: false,
      current: null,
    }
    emitStats(
      ctx.trace,
      capped
        ? `Scanning ${toScan.length} new email(s) — capped from ${fresh.length}`
        : `Scanning ${toScan.length} new email(s)`,
      stats,
    )

    // The final trace + payload when the run is aborted (Stop / AI off). Saved
    // incrementally → empty payload; otherwise hand the batch to the engine.
    const stopped = (): RawPayload[] => {
      stats.current = null
      stats.paused = false
      stats.done = true
      emitStats(
        ctx.trace,
        `Stopped — ${stats.jobsKept} job(s) from ${stats.emailsProcessed}/${stats.emailsTotal} emails`,
        stats,
      )
      return ctx.saveJobs !== undefined ? [] : [{ kind: 'jobs', body: JSON.stringify(jobs) }]
    }

    for (const { message, accountEmail } of toScan) {
      // Interrupt point: Stop (or AI off) aborts here, keeping whatever we've
      // extracted so far rather than discarding the run.
      if (ctx.signal?.aborted) return stopped()

      // Pause point: hold the scan here (funnel shows Paused) until resumed. The
      // same email is processed on resume — nothing is skipped.
      if (ctx.isPaused?.() === true) {
        stats.paused = true
        emitStats(
          ctx.trace,
          `Paused · ${stats.emailsProcessed}/${stats.emailsTotal} scanned`,
          stats,
        )
        await ctx.waitForResume?.()
        stats.paused = false
        if (ctx.signal?.aborted) return stopped() // stopped while paused
        emitStats(ctx.trace, 'Resumed', stats)
      }

      // Surface the in-flight email before the (slow) LLM call, so the funnel
      // shows (and links) which email is being analyzed right now.
      stats.current = {
        subject: message.subject,
        sender: message.from,
        url: gmailLink(accountEmail, message.messageId),
      }
      emitStats(ctx.trace, `Analyzing "${clip(message.subject)}"`, stats)

      const { jobs: extracted, proposed } = await extractJobsFromEmail(message, llm, ctx.signal)
      // Stop can abort mid-generation: bail WITHOUT counting or marking this
      // email (its output is incomplete), so it's re-scanned next time.
      if (ctx.signal?.aborted) return stopped()
      stats.emailsProcessed += 1
      stats.jobsProposed += proposed
      stats.jobsKept += extracted.length
      if (extracted.length > 0) {
        stats.emailsAccepted += 1
        // Persist this email's jobs BEFORE marking it processed, so a crash
        // never loses saved work and never skips an email whose jobs weren't
        // saved. (Fallback: no saveJobs → accumulate for the batch return.)
        await ctx.saveJobs?.(extracted)
        jobs.push(...extracted)
      } else {
        stats.emailsRejected += 1
      }
      // Remember it so future syncs skip it — scanned once, accepted or not.
      if (message.messageId !== null) seen?.add(message.messageId)
      emitStats(
        ctx.trace,
        `${clip(message.subject)} · ${extracted.length > 0 ? `${extracted.length} job(s)` : 'no jobs'}`,
        stats,
      )
    }

    stats.current = null
    stats.paused = false
    stats.done = true
    ctx.logger.info(
      `mailbox: kept ${stats.jobsKept} jobs from ${stats.emailsAccepted}/${stats.emailsTotal} emails`,
    )
    emitStats(
      ctx.trace,
      `Done — ${stats.jobsKept} job(s) from ${stats.emailsTotal} email(s)`,
      stats,
    )
    return ctx.saveJobs !== undefined ? [] : [{ kind: 'jobs', body: JSON.stringify(jobs) }]
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
