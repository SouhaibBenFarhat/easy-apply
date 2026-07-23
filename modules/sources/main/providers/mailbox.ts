import type { NormalizedJob } from '@sources/shared'
import { describeError } from '@sources/shared'
import type { MailAccount, MailEnvelope, MailMessage } from '../mail'
import { describeMailError, readMessages, readRecentEnvelopes } from '../mail'
import { extractJobsFromEmail } from '../mail-extract'
import { TRIAGE_CHUNK_SIZE, triageEnvelopes } from '../mail-triage'
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
// `durationMs` rides along on rows that complete a step (verdicts, Done).
function emitStats(
  trace: TraceFn | undefined,
  label: string,
  stats: AgentPipelineStats,
  durationMs?: number,
): void {
  trace?.({
    channel: 'pipeline',
    label,
    stats: { ...stats },
    ...(durationMs === undefined ? {} : { durationMs }),
  })
}

// Upper bound on the triage batches before stage 1 has run: at worst every
// fresh email needs the model. The real (smaller) figure replaces it as soon as
// triage reports its first batch, so the bar never sits at an unknown total.
function countTriageChunks(freshCount: number): number {
  return Math.max(1, Math.ceil(freshCount / TRIAGE_CHUNK_SIZE))
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

    // The funnel's state for the whole run. It exists from the first phase (not
    // just once scanning starts) so the panel can say what is happening during
    // the minutes of reading and triaging that precede any email.
    const stats: AgentPipelineStats = {
      phase: 'reading',
      // Reading is counted in inboxes — known up front, so the bar shows real
      // progress from the very first tick.
      phaseDone: 0,
      phaseTotal: accounts.length,
      emailsTotal: 0,
      emailsProcessed: 0,
      emailsAccepted: 0,
      emailsRejected: 0,
      jobsProposed: 0,
      jobsKept: 0,
      capped: false,
      done: false,
      paused: false,
      current: null,
    }
    emitStats(ctx.trace, 'Reading inbox…', stats)

    // PHASE 1 — headers only, across every connected inbox. Cheap: no bodies,
    // no attachments, no inline images. Each envelope keeps its account so we
    // can deep-link the right Gmail inbox and re-open the right connection.
    const envelopes: Array<{ envelope: MailEnvelope; accountEmail: string }> = []
    for (const account of accounts) {
      // Connect+list time for this inbox — stamped on the outcome row either way.
      const readStartedAt = Date.now()
      try {
        // Every mailbox trace names its account: with several inboxes connected
        // an anonymous "an inbox failed" is unactionable — you can't tell which
        // address to go fix.
        ctx.trace?.({ channel: 'mailbox', label: `Connecting to ${account.email}…` })
        const found = await readRecentEnvelopes(createMail(toMailAccount(account)), {
          mailbox: MAILBOX,
          since,
        })
        stats.phaseDone += 1
        emitStats(
          ctx.trace,
          `Found ${found.length} email(s) in ${account.email}`,
          stats,
          Date.now() - readStartedAt,
        )
        envelopes.push(...found.map((envelope) => ({ envelope, accountEmail: account.email })))
      } catch (error) {
        // One inbox failing (bad password, IMAP hiccup) never sinks the rest.
        const message = describeMailError(error)
        ctx.logger.error(`mailbox: read failed for ${account.email} — ${message}`)
        // A failed inbox still advances the phase — it is done being attempted.
        stats.phaseDone += 1
        ctx.trace?.({
          channel: 'mailbox',
          label: `Inbox read failed — ${account.email}`,
          body: message,
          stats: { ...stats },
          durationMs: Date.now() - readStartedAt,
        })
      }
    }

    // Only scan NEW mail: drop anything already processed in a past sync, and
    // take the most-recent first so the per-run cap keeps the freshest alerts.
    // Filtering on HEADERS is the point — bodies are downloaded after this, so
    // a window that is 90% already-scanned costs 10% of the download.
    const seen = ctx.processedMessages
    const fresh = envelopes
      .filter(
        ({ envelope }) =>
          envelope.messageId === null || seen === undefined || !seen.has(envelope.messageId),
      )
      .sort((a, b) => Date.parse(b.envelope.date) - Date.parse(a.envelope.date))

    // TRIAGE — decide which of the new mail is worth an extraction call, from
    // headers alone. Extraction costs a full LLM generation per email whether
    // or not it holds jobs; this is what stops 180 newsletters from each
    // costing 40 s to conclude "no jobs". Failing open is the rule throughout:
    // anything triage cannot judge is scanned, never dropped.
    const triageStartedAt = Date.now()
    stats.phase = 'triaging'
    // Counted in model calls. The deterministic pass costs nothing, so the
    // chunks the model is asked about ARE the work — and their count is known
    // before the first one runs.
    stats.phaseDone = 0
    stats.phaseTotal = countTriageChunks(fresh.length)
    emitStats(ctx.trace, `Triaging ${fresh.length} email(s)…`, stats)
    const triage = await triageEnvelopes(
      fresh.map(({ envelope }) => envelope),
      {
        ...(llm === undefined ? {} : { llm }),
        ...(ctx.signal === undefined ? {} : { signal: ctx.signal }),
        onChunk: (done, total) => {
          // The real total is known only once stage 1 has sorted the easy mail
          // out, so adopt it the moment triage reports it.
          stats.phaseDone = done
          stats.phaseTotal = total
          emitStats(ctx.trace, `Triage · batch ${done}/${total}`, stats)
        },
      },
    )
    const keptUids = new Set(triage.selected.map((envelope) => envelope.uid))
    const triaged = fresh.filter(({ envelope }) => keptUids.has(envelope.uid))
    // A triaged-out email has been judged, so remember it — otherwise every
    // sync re-triages the same newsletters for the whole 30-day window. The
    // cost of being wrong is that a mis-skipped email is never reconsidered,
    // which is why triage errs toward keeping (and never runs on an aborted or
    // unreadable answer).
    for (const { envelope } of fresh) {
      if (!keptUids.has(envelope.uid) && envelope.messageId !== null) seen?.add(envelope.messageId)
    }
    ctx.trace?.({
      channel: 'mailbox',
      label: `Triage kept ${triaged.length} of ${fresh.length} — ${fresh.length - triaged.length} skipped`,
      durationMs: Date.now() - triageStartedAt,
    })

    const capped = triaged.length > MAX_EMAILS_PER_RUN
    const selected = triaged.slice(0, MAX_EMAILS_PER_RUN)

    // PHASE 2 — bodies for the survivors only, one connection per account.
    const bodyStartedAt = Date.now()
    stats.phase = 'downloading'
    // Counted in inboxes again — one fetch per account that has anything to get.
    stats.phaseDone = 0
    stats.phaseTotal = 0
    if (selected.length > 0) emitStats(ctx.trace, `Downloading ${selected.length} email(s)…`, stats)
    const uidsByAccount = new Map<string, number[]>()
    for (const { envelope, accountEmail } of selected) {
      const uids = uidsByAccount.get(accountEmail) ?? []
      uids.push(envelope.uid)
      uidsByAccount.set(accountEmail, uids)
    }
    stats.phaseTotal = uidsByAccount.size
    const bodyByKey = new Map<string, MailMessage>()
    for (const account of accounts) {
      const uids = uidsByAccount.get(account.email)
      if (uids === undefined) continue
      try {
        const fetched = await readMessages(createMail(toMailAccount(account)), {
          mailbox: MAILBOX,
          uids,
        })
        for (const message of fetched) bodyByKey.set(`${account.email}:${message.uid}`, message)
        stats.phaseDone += 1
        emitStats(ctx.trace, `Downloaded ${fetched.length} from ${account.email}`, stats)
      } catch (error) {
        // Same isolation as phase 1: one inbox failing to hand over bodies
        // leaves the other inboxes' emails scannable.
        const message = describeMailError(error)
        ctx.logger.error(`mailbox: body fetch failed for ${account.email} — ${message}`)
        stats.phaseDone += 1
        ctx.trace?.({
          channel: 'mailbox',
          label: `Inbox read failed — ${account.email}`,
          body: message,
          stats: { ...stats },
        })
      }
    }
    // Envelopes whose body never arrived can't be scanned — drop them here so
    // the funnel total matches what will actually be attempted.
    const toScan = selected.flatMap(({ envelope, accountEmail }) => {
      const message = bodyByKey.get(`${accountEmail}:${envelope.uid}`)
      return message === undefined ? [] : [{ message, accountEmail }]
    })
    if (selected.length > 0)
      ctx.trace?.({
        channel: 'mailbox',
        label: `Downloaded ${toScan.length} email(s)`,
        durationMs: Date.now() - bodyStartedAt,
      })
    // Scanning is the one phase with a real total, so the bar becomes
    // determinate from here.
    stats.phase = 'scanning'
    stats.emailsTotal = toScan.length
    stats.capped = capped
    // Wall-clock for the whole scan — the 'Scanning…' row marks its start, the
    // Done/Stopped row reports it. Pauses count: elapsed time is elapsed time.
    const scanStartedAt = Date.now()
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
      stats.phase = 'done'
      emitStats(
        ctx.trace,
        `Stopped — ${stats.jobsKept} job(s) from ${stats.emailsProcessed}/${stats.emailsTotal} emails`,
        stats,
        Date.now() - scanStartedAt,
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

      // This email's execution time: from its 'Analyzing' row (pause holds
      // happen above, so hold time never inflates it) to its verdict row.
      const emailStartedAt = Date.now()
      // Per-email isolation, the same rule the engine applies to providers and
      // the loop above applies to inboxes: ONE email must never sink the scan.
      // Without this a single failing save aborted the whole provider, and a
      // 200-email run "finished" having processed none of them.
      // Counters are applied as the email progresses, so a throw mid-way must
      // roll them back before recording the failure — otherwise a save that
      // died after `jobsKept += …` would claim jobs that never reached the DB.
      const countsBefore = { ...stats }
      try {
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
        // The verdict event carries the jobs themselves, not just a count, so
        // the monitor can show exactly what this email produced and you can
        // check the agent's judgement against the real posting.
        ctx.trace?.({
          channel: 'pipeline',
          label: `${clip(message.subject)} · ${extracted.length > 0 ? `${extracted.length} job(s)` : 'no jobs'}`,
          stats: { ...stats },
          jobs: extracted.map((job) => ({
            id: job.id,
            title: job.title,
            company: job.company,
            url: job.applyUrl ?? job.url,
          })),
          durationMs: Date.now() - emailStartedAt,
        })
      } catch (error) {
        // A Stop that surfaces as a rejection is not a failure — treat it as
        // the interrupt it is.
        if (ctx.signal?.aborted) return stopped()
        const reason = describeError(error)
        ctx.logger.error(`mailbox: email failed — ${reason}`)
        // Undo whatever this email applied before it threw, then count it once
        // as processed-but-failed.
        Object.assign(stats, countsBefore)
        stats.emailsProcessed += 1
        stats.emailsRejected += 1
        stats.current = null
        // The email is deliberately NOT marked processed: a transient failure
        // (DB hiccup, model glitch) gets another chance on the next sync.
        emitStats(
          ctx.trace,
          `${clip(message.subject)} · failed — skipped`,
          stats,
          Date.now() - emailStartedAt,
        )
        ctx.trace?.({
          channel: 'mailbox',
          label: `Email failed — ${clip(message.subject)}`,
          body: reason,
        })
      }
    }

    stats.current = null
    stats.paused = false
    stats.done = true
    stats.phase = 'done'
    ctx.logger.info(
      `mailbox: kept ${stats.jobsKept} jobs from ${stats.emailsAccepted}/${stats.emailsTotal} emails`,
    )
    emitStats(
      ctx.trace,
      `Done — ${stats.jobsKept} job(s) from ${stats.emailsTotal} email(s)`,
      stats,
      Date.now() - scanStartedAt,
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
