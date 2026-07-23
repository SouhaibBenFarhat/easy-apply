// @vitest-environment node
import type { Logger } from '@logger'
import { DEFAULT_SEARCH_PROFILE } from '@sources/shared'
import { describe, expect, it } from 'vitest'
import type { PoliteHttpClient } from '../http'
import type { MailDriver, MailMessage } from '../mail'
import type { LlmClient } from '../mail-extract'
import { serializeAccounts } from '../mailbox-accounts'
import type { AgentTraceInput, FetchContext } from '../types'
import { mailboxProvider } from './mailbox'

// Records which uids actually had their bodies downloaded, so the tests can
// assert the two-phase read never pulls a body it doesn't need.
interface DriverLog {
  fetchedUids: number[]
}

function fakeDriver(messages: MailMessage[], log?: DriverLog): MailDriver {
  return {
    connect: async () => {},
    listEnvelopes: async () => messages.map(({ html, text, ...envelope }) => envelope),
    fetchMessages: async (request) => {
      log?.fetchedUids.push(...request.uids)
      return messages.filter((message) => request.uids.includes(message.uid))
    },
    close: async () => {},
  }
}

// A fake LLM that emits a job whose apply URL determines the board, or an empty
// array for anything else — so we can watch the read-everything funnel accept,
// reject, and route emails by the extracted URL.
// Triage asks the model to pick numbers from a list; keeping everything makes
// these tests about the SCANNING loop, which is what they exercise. Triage's
// own filtering is covered in mail-triage.test.ts, and by the dedicated test
// below.
function keepAllTriageAnswer(prompt: string): string {
  const rows = prompt.split('\n').filter((line) => /^\d+ \| /.test(line)).length
  return JSON.stringify(Array.from({ length: rows }, (_, i) => i + 1))
}

function isTriagePrompt(prompt: string): boolean {
  return prompt.includes('numbered list of emails')
}

function fakeLlm(): LlmClient {
  return {
    complete: async (prompt) => {
      if (isTriagePrompt(prompt)) return keepAllTriageAnswer(prompt)
      if (prompt.includes('LINKEDIN'))
        return JSON.stringify([
          { title: 'LI role', company: 'Acme', applyUrl: 'https://linkedin.com/jobs/1' },
        ])
      if (prompt.includes('STEPSTONE'))
        return JSON.stringify([
          { title: 'SS role', company: 'Beta', applyUrl: 'https://stepstone.de/2' },
        ])
      return '[]' // no jobs in this email
    },
  }
}

function makeCtx(
  config: Record<string, string> = {},
  messages: MailMessage[] = [],
  withRuntime = true,
  trace?: (event: AgentTraceInput) => void,
  log?: DriverLog,
): FetchContext {
  const noop = (): void => {}
  const logger: Logger = { debug: noop, info: noop, warn: noop, error: noop }
  const ctx: FetchContext = {
    http: {} as unknown as PoliteHttpClient,
    config,
    searchProfile: DEFAULT_SEARCH_PROFILE,
    logger,
  }
  if (withRuntime) {
    ctx.createMail = () => fakeDriver(messages, log)
    ctx.llm = fakeLlm()
  }
  if (trace !== undefined) ctx.trace = trace
  return ctx
}

function msg(uid: number, from: string, body: string): MailMessage {
  return {
    uid,
    from,
    subject: 's',
    date: '2026-07-21T09:00:00.000Z',
    html: body,
    text: null,
    messageId: `<msg-${uid}@mail>`,
  }
}

const accounts = serializeAccounts([{ email: 'me@gmail.com', appPassword: 'pw' }])

describe('mailboxProvider.fetch', () => {
  it('skips when no inbox is connected', async () => {
    expect(await mailboxProvider.fetch(makeCtx())).toEqual([])
  })

  it('skips when the mail/LLM runtime is unavailable', async () => {
    expect(await mailboxProvider.fetch(makeCtx(accounts, [], false))).toEqual([])
  })

  it('reads every email and routes jobs by their apply URL', async () => {
    const ctx = makeCtx(accounts, [
      msg(1, 'jobalerts-noreply@linkedin.com', 'LINKEDIN alert'),
      msg(2, 'noreply@stepstone.de', 'STEPSTONE alert'),
      msg(3, 'newsletter@random.io', 'just a newsletter, no jobs'),
    ])
    const payloads = await mailboxProvider.fetch(ctx)
    const jobs = mailboxProvider.parse(payloads[0] ?? { kind: 'jobs', body: '[]' }, ctx)
    // Every email is read (no sender gate); the newsletter yields nothing.
    expect(jobs.map((job) => job.sourceId).sort()).toEqual(['linkedin', 'stepstone'])
  })

  it('emits a live funnel of the accepted/rejected/kept counts', async () => {
    const traces: AgentTraceInput[] = []
    const ctx = makeCtx(
      accounts,
      [
        msg(1, 'a@linkedin.com', 'LINKEDIN alert'),
        msg(2, 'b@stepstone.de', 'STEPSTONE alert'),
        msg(3, 'c@random.io', 'just a newsletter'),
      ],
      true,
      (event) => traces.push(event),
    )
    await mailboxProvider.fetch(ctx)

    const lastStats = [...traces].reverse().find((event) => event.stats !== undefined)?.stats
    expect(lastStats).toMatchObject({
      emailsTotal: 3,
      emailsProcessed: 3,
      emailsAccepted: 2,
      emailsRejected: 1,
      jobsProposed: 2,
      jobsKept: 2,
      capped: false,
      done: true, // the terminal "Done" event marks the run finished
      current: null, // cleared once the run is done
    })
    // The in-flight email (subject + sender + Gmail deep link) is surfaced. The
    // account goes in `authuser`, never the `/u/` path (an email there 404s).
    const analyzing = traces.find((event) => event.stats?.current != null)
    expect(analyzing?.stats?.current).toMatchObject({ subject: 's', sender: 'a@linkedin.com' })
    expect(analyzing?.stats?.current?.url).toBe(
      'https://mail.google.com/mail/u/0/?authuser=me%40gmail.com#search/rfc822msgid%3Amsg-1%40mail',
    )
  })

  it('stamps execution time on step-completion rows, never on start markers', async () => {
    const traces: AgentTraceInput[] = []
    const ctx = makeCtx(
      accounts,
      [msg(1, 'a@linkedin.com', 'LINKEDIN alert'), msg(2, 'c@random.io', 'just a newsletter')],
      true,
      (event) => traces.push(event),
    )
    await mailboxProvider.fetch(ctx)

    const byLabel = (re: RegExp): AgentTraceInput[] =>
      traces.filter((event) => re.test(event.label))
    // Completion rows carry the measured duration: the inbox read, every
    // per-email verdict, and the terminal Done summary.
    for (const event of [
      ...byLabel(/^Found \d+ email/),
      ...traces.filter((entry) => entry.jobs !== undefined),
      ...byLabel(/^Done —/),
    ]) {
      expect(event.durationMs).toBeGreaterThanOrEqual(0)
    }
    expect(traces.filter((entry) => entry.jobs !== undefined)).toHaveLength(2)
    // Start markers are the other end of the measurement — no duration.
    for (const event of [
      ...byLabel(/^Connecting/),
      ...byLabel(/^Analyzing/),
      ...byLabel(/^Scanning/),
    ]) {
      expect(event.durationMs).toBeUndefined()
    }
  })

  it('skips emails already processed in a past sync and remembers new ones', async () => {
    const processed = new Set(['<msg-1@mail>'])
    const log: DriverLog = { fetchedUids: [] }
    const ctx = makeCtx(
      accounts,
      [msg(1, 'a@linkedin.com', 'LINKEDIN alert'), msg(2, 'b@stepstone.de', 'STEPSTONE alert')],
      true,
      undefined,
      log,
    )
    ctx.processedMessages = { has: (id) => processed.has(id), add: (id) => processed.add(id) }

    const payloads = await mailboxProvider.fetch(ctx)
    const jobs = mailboxProvider.parse(payloads[0] ?? { kind: 'jobs', body: '[]' }, ctx)

    // msg 1 was already seen → only the stepstone email is scanned.
    expect(jobs.map((job) => job.sourceId)).toEqual(['stepstone'])
    // The newly-scanned message is remembered for next time.
    expect(processed.has('<msg-2@mail>')).toBe(true)
    // …and crucially its BODY was never downloaded: the whole point of the
    // two-phase read is that an already-scanned window costs headers only.
    expect(log.fetchedUids).toEqual([2])
  })

  // Once the window has been fully scanned, a sync must cost headers alone —
  // no bodies, no connection for the (empty) fetch phase.
  it('downloads no bodies at all when every email was already processed', async () => {
    const processed = new Set(['<msg-1@mail>', '<msg-2@mail>'])
    const log: DriverLog = { fetchedUids: [] }
    const ctx = makeCtx(
      accounts,
      [msg(1, 'a@linkedin.com', 'LINKEDIN alert'), msg(2, 'b@stepstone.de', 'STEPSTONE alert')],
      true,
      undefined,
      log,
    )
    ctx.processedMessages = { has: (id) => processed.has(id), add: (id) => processed.add(id) }

    await mailboxProvider.fetch(ctx)

    expect(log.fetchedUids).toEqual([])
  })

  it('saves each email incrementally via saveJobs, marking it processed after', async () => {
    const saved: string[] = []
    const processed = new Set<string>()
    const ctx = makeCtx(accounts, [msg(1, 'a@linkedin.com', 'LINKEDIN alert')])
    ctx.processedMessages = { has: (id) => processed.has(id), add: (id) => processed.add(id) }
    ctx.saveJobs = async (batch) => {
      saved.push(...batch.map((job) => job.sourceId))
      return { inserted: batch.length, updated: 0 }
    }

    const payloads = await mailboxProvider.fetch(ctx)

    // Jobs were persisted mid-scan, so the batch payload is empty…
    expect(payloads).toEqual([])
    // …the job reached saveJobs…
    expect(saved).toEqual(['linkedin'])
    // …and the email is marked processed only after its jobs are durable.
    expect(processed.has('<msg-1@mail>')).toBe(true)
  })

  // Triage is the whole point of the rework: an email that isn't job mail must
  // never reach the (slow) extraction call, and its body must never be
  // downloaded either.
  it('skips non-job mail before downloading or extracting it', async () => {
    const log: DriverLog = { fetchedUids: [] }
    const extractionPrompts: string[] = []
    const processed = new Set<string>()
    const ctx = makeCtx(
      accounts,
      [
        msg(1, 'a@linkedin.com', 'LINKEDIN alert'),
        msg(2, 'newsletter@medium.com', 'nothing to see'),
      ],
      true,
      undefined,
      log,
    )
    ctx.processedMessages = { has: (id) => processed.has(id), add: (id) => processed.add(id) }
    // Triage rejects everything it is asked about; the LinkedIn mail never gets
    // asked (its sender decides it deterministically).
    ctx.llm = {
      complete: async (prompt) => {
        if (isTriagePrompt(prompt)) return '[]'
        extractionPrompts.push(prompt)
        return JSON.stringify([
          { title: 'LI role', company: 'Acme', applyUrl: 'https://linkedin.com/jobs/1' },
        ])
      },
    }

    await mailboxProvider.fetch(ctx)

    // Only the LinkedIn email was downloaded and extracted.
    expect(log.fetchedUids).toEqual([1])
    expect(extractionPrompts).toHaveLength(1)
    // The triaged-out email is remembered, so it isn't re-judged every sync.
    expect(processed.has('<msg-2@mail>')).toBe(true)
  })

  // The bug behind "it finishes without going through all emails": one failing
  // save aborted the entire provider, so a 200-email run ended having
  // processed none of them. One email must never sink the scan.
  it('keeps scanning when one email fails, and retries it next sync', async () => {
    const traces: AgentTraceInput[] = []
    const processed = new Set<string>()
    const ctx = makeCtx(
      accounts,
      [
        msg(1, 'a@linkedin.com', 'LINKEDIN alert'),
        msg(2, 'b@stepstone.de', 'STEPSTONE alert'),
        msg(3, 'c@random.io', 'just a newsletter'),
      ],
      true,
      (event) => traces.push(event),
    )
    ctx.processedMessages = { has: (id) => processed.has(id), add: (id) => processed.add(id) }
    // The first email's save blows up the way the real one did — a wrapped DB
    // error whose real reason hides in `cause`.
    let saves = 0
    ctx.saveJobs = async (batch) => {
      saves += 1
      if (saves === 1)
        throw new Error('Failed query: insert into "jobs" …', {
          cause: new Error('ON CONFLICT DO UPDATE command cannot affect row a second time'),
        })
      return { inserted: batch.length, updated: 0 }
    }

    await mailboxProvider.fetch(ctx)

    // The scan ran to completion instead of dying on email 1, and the failed
    // email is counted exactly once — with none of its unsaved jobs claimed.
    const last = [...traces].reverse().find((event) => event.stats !== undefined)?.stats
    expect(last).toMatchObject({
      emailsTotal: 3,
      emailsProcessed: 3,
      emailsAccepted: 1, // only the stepstone email saved successfully
      emailsRejected: 2, // the newsletter + the failed one
      jobsKept: 1,
      done: true,
    })
    expect(traces.some((event) => /^Done —/.test(event.label))).toBe(true)
    // The failure is visible, with the root cause, not swallowed.
    const failure = traces.find((event) => /^Email failed/.test(event.label))
    expect(failure?.body).toContain('cannot affect row a second time')
    // The failed email is not marked processed → it is retried next sync,
    // while the ones that succeeded are remembered.
    expect(processed.has('<msg-1@mail>')).toBe(false)
    expect(processed.has('<msg-2@mail>')).toBe(true)
    expect(processed.has('<msg-3@mail>')).toBe(true)
  })

  it('stops the scan when the signal is aborted', async () => {
    const controller = new AbortController()
    controller.abort() // interrupt before any email is processed
    const traces: AgentTraceInput[] = []
    const ctx = makeCtx(
      accounts,
      [msg(1, 'a@linkedin.com', 'LINKEDIN alert'), msg(2, 'b@stepstone.de', 'STEPSTONE alert')],
      true,
      (event) => traces.push(event),
    )
    ctx.signal = controller.signal

    const payloads = await mailboxProvider.fetch(ctx)
    const jobs = mailboxProvider.parse(payloads[0] ?? { kind: 'jobs', body: '[]' }, ctx)

    expect(jobs).toEqual([]) // aborted before extracting anything
    expect(traces.some((event) => /Stopped/.test(event.label))).toBe(true)
  })

  it('holds at the pause gate until resumed, then processes the same email', async () => {
    let resume = (): void => {}
    let paused = true
    const traces: AgentTraceInput[] = []
    const ctx = makeCtx(accounts, [msg(1, 'a@linkedin.com', 'LINKEDIN alert')], true, (event) =>
      traces.push(event),
    )
    ctx.isPaused = () => paused
    ctx.waitForResume = () =>
      new Promise<void>((resolve) => {
        resume = () => {
          paused = false
          resolve()
        }
      })

    const done = mailboxProvider.fetch(ctx)
    // Let the async inbox read + loop reach the pause gate (which then hangs).
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(traces.some((event) => /Paused/.test(event.label))).toBe(true)
    expect(traces.some((event) => /Resumed|Done/.test(event.label))).toBe(false)

    resume()
    const payloads = await done
    const jobs = mailboxProvider.parse(payloads[0] ?? { kind: 'jobs', body: '[]' }, ctx)

    // After resume the held email is still processed (nothing skipped).
    expect(jobs.map((job) => job.sourceId)).toEqual(['linkedin'])
    expect(traces.some((event) => /Resumed/.test(event.label))).toBe(true)
  })

  it('halts mid-email when Stop aborts during generation, without marking it', async () => {
    const controller = new AbortController()
    const processed = new Set<string>()
    const ctx = makeCtx(accounts, [
      msg(1, 'a@linkedin.com', 'LINKEDIN alert'),
      msg(2, 'b@stepstone.de', 'STEPSTONE alert'),
    ])
    ctx.processedMessages = { has: (id) => processed.has(id), add: (id) => processed.add(id) }
    ctx.signal = controller.signal
    // Simulate Stop pressed while the first email's generation is running.
    ctx.llm = {
      complete: async () => {
        controller.abort()
        return '[]'
      },
    }

    await mailboxProvider.fetch(ctx)

    // The interrupted email is NOT marked processed → it gets retried next sync.
    expect(processed.size).toBe(0)
  })
})

describe('mailboxProvider.parse', () => {
  const ctx = makeCtx()
  it('deserializes the jobs fetch produced', () => {
    const job = { id: 'linkedin:x', sourceId: 'linkedin', title: 'Dev' }
    expect(mailboxProvider.parse({ kind: 'jobs', body: JSON.stringify([job]) }, ctx)).toEqual([job])
  })

  it('returns [] for a malformed or non-array body', () => {
    expect(mailboxProvider.parse({ kind: 'jobs', body: 'not json' }, ctx)).toEqual([])
    expect(mailboxProvider.parse({ kind: 'jobs', body: '{}' }, ctx)).toEqual([])
  })
})
