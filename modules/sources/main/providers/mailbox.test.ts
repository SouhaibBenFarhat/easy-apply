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

function fakeDriver(messages: MailMessage[]): MailDriver {
  return {
    connect: async () => {},
    search: async () => messages,
    close: async () => {},
  }
}

// A fake LLM that emits a job whose apply URL determines the board, or an empty
// array for anything else — so we can watch the read-everything funnel accept,
// reject, and route emails by the extracted URL.
function fakeLlm(): LlmClient {
  return {
    complete: async (prompt) => {
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
    ctx.createMail = () => fakeDriver(messages)
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

  it('skips emails already processed in a past sync and remembers new ones', async () => {
    const processed = new Set(['<msg-1@mail>'])
    const ctx = makeCtx(accounts, [
      msg(1, 'a@linkedin.com', 'LINKEDIN alert'),
      msg(2, 'b@stepstone.de', 'STEPSTONE alert'),
    ])
    ctx.processedMessages = { has: (id) => processed.has(id), add: (id) => processed.add(id) }

    const payloads = await mailboxProvider.fetch(ctx)
    const jobs = mailboxProvider.parse(payloads[0] ?? { kind: 'jobs', body: '[]' }, ctx)

    // msg 1 was already seen → only the stepstone email is scanned.
    expect(jobs.map((job) => job.sourceId)).toEqual(['stepstone'])
    // The newly-scanned message is remembered for next time.
    expect(processed.has('<msg-2@mail>')).toBe(true)
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
