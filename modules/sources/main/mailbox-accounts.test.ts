// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  addAccount,
  listAccountEmails,
  type MailboxAccount,
  parseAccounts,
  removeAccount,
  serializeAccounts,
} from './mailbox-accounts'

const a = (email: string, appPassword = 'pw'): MailboxAccount => ({ email, appPassword })

describe('parseAccounts', () => {
  it('reads a well-formed account list from the config', () => {
    const config = serializeAccounts([a('one@gmail.com'), a('two@gmail.com')])
    expect(parseAccounts(config)).toEqual([a('one@gmail.com'), a('two@gmail.com')])
  })

  it('returns [] for missing, non-array, or malformed config without throwing', () => {
    expect(parseAccounts({})).toEqual([])
    expect(parseAccounts({ accounts: 'not json {' })).toEqual([])
    expect(parseAccounts({ accounts: '{}' })).toEqual([])
    expect(parseAccounts({ accounts: '[42, null, {"email":"x"}]' })).toEqual([])
  })

  it('drops blank fields and collapses case-insensitive duplicates', () => {
    const config = {
      accounts: JSON.stringify([
        a('keep@gmail.com'),
        { email: '  ', appPassword: 'pw' },
        { email: 'x@gmail.com', appPassword: '' },
        a('KEEP@gmail.com', 'other'),
      ]),
    }
    expect(parseAccounts(config)).toEqual([a('keep@gmail.com')])
  })
})

describe('addAccount', () => {
  it('appends a new account', () => {
    expect(addAccount([a('one@gmail.com')], a('two@gmail.com'))).toEqual([
      a('one@gmail.com'),
      a('two@gmail.com'),
    ])
  })

  it('replaces an existing address (case-insensitive), keeping it once', () => {
    const next = addAccount([a('one@gmail.com', 'old')], a('ONE@gmail.com', 'new'))
    expect(next).toEqual([a('ONE@gmail.com', 'new')])
  })

  it('trims the email', () => {
    expect(addAccount([], a('  spaced@gmail.com  '))).toEqual([a('spaced@gmail.com')])
  })
})

describe('removeAccount', () => {
  it('removes by email, case-insensitively, and is a no-op for unknowns', () => {
    const accounts = [a('one@gmail.com'), a('two@gmail.com')]
    expect(removeAccount(accounts, 'ONE@gmail.com')).toEqual([a('two@gmail.com')])
    expect(removeAccount(accounts, 'nope@gmail.com')).toEqual(accounts)
  })
})

describe('serializeAccounts / listAccountEmails', () => {
  it('round-trips through the config codec', () => {
    const accounts = [a('one@gmail.com'), a('two@gmail.com')]
    expect(parseAccounts(serializeAccounts(accounts))).toEqual(accounts)
  })

  it('lists the emails only', () => {
    expect(listAccountEmails([a('one@gmail.com'), a('two@gmail.com')])).toEqual([
      'one@gmail.com',
      'two@gmail.com',
    ])
  })
})
