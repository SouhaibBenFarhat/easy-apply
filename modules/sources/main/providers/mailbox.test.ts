// @vitest-environment node
import type { Logger } from '@logger'
import { DEFAULT_SEARCH_PROFILE } from '@sources/shared'
import { describe, expect, it } from 'vitest'
import type { PoliteHttpClient } from '../http'
import type { MailDriver, MailMessage } from '../mail'
import type { LlmClient } from '../mail-extract'
import { serializeAccounts } from '../mailbox-accounts'
import type { FetchContext } from '../types'
import { mailboxProvider } from './mailbox'

function fakeDriver(messages: MailMessage[]): MailDriver {
  return {
    connect: async () => {},
    search: async () => messages,
    close: async () => {},
  }
}

// A fake LLM that returns one job per email, tagged with the email uid so we
// can see it flowed through.
function fakeLlm(): LlmClient {
  return {
    complete: async (prompt) => {
      const marker = prompt.includes('LINKEDIN') ? 'li' : 'other'
      return JSON.stringify([
        { title: `Role ${marker}`, company: 'Acme', applyUrl: `https://x.com/${marker}` },
      ])
    },
  }
}

function makeCtx(
  config: Record<string, string> = {},
  messages: MailMessage[] = [],
  withRuntime = true,
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
  return ctx
}

function msg(uid: number, from: string, body: string): MailMessage {
  return { uid, from, subject: 's', date: '2026-07-21T09:00:00.000Z', html: body, text: null }
}

const accounts = serializeAccounts([{ email: 'me@gmail.com', appPassword: 'pw' }])

describe('mailboxProvider.fetch', () => {
  it('skips when no inbox is connected', async () => {
    expect(await mailboxProvider.fetch(makeCtx())).toEqual([])
  })

  it('skips when the mail/LLM runtime is unavailable', async () => {
    expect(await mailboxProvider.fetch(makeCtx(accounts, [], false))).toEqual([])
  })

  it('reads alerts, routes them by sender, and extracts jobs', async () => {
    const ctx = makeCtx(accounts, [
      msg(1, 'jobalerts-noreply@linkedin.com', 'LINKEDIN alert'),
      msg(2, 'alert@indeed.com', 'indeed alert'),
      msg(3, 'newsletter@random.io', 'ignored — unknown sender'),
    ])
    const payloads = await mailboxProvider.fetch(ctx)
    const jobs = mailboxProvider.parse(payloads[0] ?? { kind: 'jobs', body: '[]' }, ctx)
    // linkedin + indeed extracted; the unknown sender is dropped.
    expect(jobs.map((job) => job.sourceId).sort()).toEqual(['indeed', 'linkedin'])
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
