// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  describeMailError,
  type MailDriver,
  type MailMessage,
  readMessages,
  readRecentEnvelopes,
} from './mail'

function message(uid: number, from: string): MailMessage {
  return {
    uid,
    from,
    subject: `Alert ${uid}`,
    date: '2026-07-21T09:00:00.000Z',
    html: `<p>job ${uid}</p>`,
    text: `job ${uid}`,
    messageId: `<msg-${uid}@mail>`,
  }
}

// A fake driver that records lifecycle calls and returns canned results (or
// throws), so the read/close logic is exercised with zero network or real
// mailbox — the PoliteHttpClient fake-injection pattern.
function fakeDriver(result: MailMessage[] | Error, calls: string[]): MailDriver {
  const yieldOrThrow = <T>(value: T): T => {
    if (result instanceof Error) throw result
    return value
  }
  return {
    connect: async () => {
      calls.push('connect')
    },
    listEnvelopes: async () => {
      calls.push('listEnvelopes')
      return yieldOrThrow(
        result instanceof Error ? [] : result.map(({ html, text, ...rest }) => rest),
      )
    },
    fetchMessages: async (request) => {
      calls.push(`fetchMessages(${request.uids.join(',')})`)
      return yieldOrThrow(
        result instanceof Error ? [] : result.filter((m) => request.uids.includes(m.uid)),
      )
    },
    close: async () => {
      calls.push('close')
    },
  }
}

const options = { mailbox: 'INBOX', since: new Date('2026-07-01T00:00:00.000Z') }

describe('readRecentEnvelopes', () => {
  it('returns every envelope the driver yields, regardless of sender', async () => {
    const calls: string[] = []
    const driver = fakeDriver(
      [
        message(1, 'jobalerts-noreply@linkedin.com'),
        message(2, 'alert@indeed.com'),
        message(3, 'newsletter@some-recruiter.io'),
      ],
      calls,
    )

    const envelopes = await readRecentEnvelopes(driver, options)

    // No sender filtering: the LLM decides what holds jobs.
    expect(envelopes.map((envelope) => envelope.uid)).toEqual([1, 2, 3])
  })

  it('connects, lists, then closes — in order', async () => {
    const calls: string[] = []
    await readRecentEnvelopes(fakeDriver([], calls), options)
    expect(calls).toEqual(['connect', 'listEnvelopes', 'close'])
  })

  it('closes the connection even when the listing fails', async () => {
    const calls: string[] = []
    const driver = fakeDriver(new Error('IMAP timeout'), calls)

    await expect(readRecentEnvelopes(driver, options)).rejects.toThrow('IMAP timeout')
    expect(calls).toEqual(['connect', 'listEnvelopes', 'close'])
  })
})

describe('readMessages', () => {
  it('downloads only the requested uids', async () => {
    const calls: string[] = []
    const driver = fakeDriver(
      [message(1, 'a@x.io'), message(2, 'b@x.io'), message(3, 'c@x.io')],
      calls,
    )

    const messages = await readMessages(driver, { mailbox: 'INBOX', uids: [1, 3] })

    expect(messages.map((m) => m.uid)).toEqual([1, 3])
    expect(calls).toEqual(['connect', 'fetchMessages(1,3)', 'close'])
  })

  // Nothing new to scan must not open a connection at all — the common case
  // once the window has already been processed.
  it('skips the connection entirely for an empty uid set', async () => {
    const calls: string[] = []
    expect(await readMessages(fakeDriver([], calls), { mailbox: 'INBOX', uids: [] })).toEqual([])
    expect(calls).toEqual([])
  })

  it('closes the connection even when the fetch fails', async () => {
    const calls: string[] = []
    const driver = fakeDriver(new Error('IMAP timeout'), calls)

    await expect(readMessages(driver, { mailbox: 'INBOX', uids: [1] })).rejects.toThrow(
      'IMAP timeout',
    )
    expect(calls).toEqual(['connect', 'fetchMessages(1)', 'close'])
  })
})

describe('describeMailError', () => {
  // The exact shape imapflow throws for an IMAP NO/BAD: a useless message, the
  // real reason on responseText/serverResponseCode.
  function imapError(responseText: string, serverResponseCode?: string): Error {
    return Object.assign(new Error('Command failed'), { responseText, serverResponseCode })
  }

  it('prefers the server response text over the generic message', () => {
    expect(describeMailError(imapError('Invalid credentials (Failure)'))).toBe(
      'Invalid credentials (Failure)',
    )
  })

  it('appends the server response code', () => {
    expect(describeMailError(imapError('Invalid credentials', 'AUTHENTICATIONFAILED'))).toBe(
      'Invalid credentials (AUTHENTICATIONFAILED)',
    )
  })

  it('does not repeat a code already present in the text', () => {
    expect(describeMailError(imapError('[ALERT] over quota', 'ALERT'))).toBe('[ALERT] over quota')
  })

  it('falls back to the message for non-IMAP failures', () => {
    expect(describeMailError(new Error('getaddrinfo ENOTFOUND imap.gmail.com'))).toBe(
      'getaddrinfo ENOTFOUND imap.gmail.com',
    )
  })

  it('survives a code-only error and a non-error throw', () => {
    expect(describeMailError(Object.assign(new Error(''), { serverResponseCode: 'NO' }))).toBe('NO')
    expect(describeMailError('boom')).toBe('boom')
    expect(describeMailError(null)).toBe('null')
    expect(describeMailError(new Error(''))).toBe('mail read failed')
  })
})
