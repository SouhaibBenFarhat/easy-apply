// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { type MailDriver, type MailMessage, readAlertMessages } from './mail'

function message(uid: number, from: string): MailMessage {
  return {
    uid,
    from,
    subject: `Alert ${uid}`,
    date: '2026-07-21T09:00:00.000Z',
    html: `<p>job ${uid}</p>`,
    text: `job ${uid}`,
  }
}

// A fake driver that records lifecycle calls and returns a canned result (or
// throws from search), so the read/filter/close logic is exercised with zero
// network or real mailbox — the PoliteHttpClient fake-injection pattern.
function fakeDriver(result: MailMessage[] | Error, calls: string[]): MailDriver {
  return {
    connect: async () => {
      calls.push('connect')
    },
    search: async () => {
      calls.push('search')
      if (result instanceof Error) throw result
      return result
    },
    close: async () => {
      calls.push('close')
    },
  }
}

describe('readAlertMessages', () => {
  const options = {
    mailbox: 'Jobs',
    senderPatterns: ['linkedin.com', 'indeed.com'],
    since: new Date('2026-07-01T00:00:00.000Z'),
  }

  it('keeps only messages from the wanted senders, case-insensitively', async () => {
    const calls: string[] = []
    const driver = fakeDriver(
      [
        message(1, 'jobalerts-noreply@linkedin.com'),
        message(2, 'alert@INDEED.com'),
        message(3, 'newsletter@some-recruiter.io'),
        message(4, 'noreply@stepstone.de'),
      ],
      calls,
    )

    const kept = await readAlertMessages(driver, options)

    expect(kept.map((m) => m.uid)).toEqual([1, 2])
  })

  it('connects, searches, then closes — in order', async () => {
    const calls: string[] = []
    await readAlertMessages(fakeDriver([], calls), options)
    expect(calls).toEqual(['connect', 'search', 'close'])
  })

  it('closes the connection even when the search fails', async () => {
    const calls: string[] = []
    const driver = fakeDriver(new Error('IMAP timeout'), calls)

    await expect(readAlertMessages(driver, options)).rejects.toThrow('IMAP timeout')
    expect(calls).toEqual(['connect', 'search', 'close'])
  })
})
