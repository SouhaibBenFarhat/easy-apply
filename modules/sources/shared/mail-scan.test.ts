import { describe, expect, it } from 'vitest'
import type { MailScanConfig } from './mail-scan'
import {
  DEFAULT_MAIL_SCAN_CONFIG,
  isExcludedSender,
  isIncludedSender,
  resolveMailScanConfig,
  subjectMatchesKeywords,
  validateMailScanConfig,
} from './mail-scan'

function config(overrides: Partial<MailScanConfig> = {}): MailScanConfig {
  return {
    domains: [
      { domain: 'linkedin.', enabled: true },
      { domain: 'glassdoor.', enabled: false },
    ],
    keywords: ['engineer', 'stelle'],
    ...overrides,
  }
}

describe('sender matching', () => {
  it('includes an enabled sender, excludes a disabled one', () => {
    expect(isIncludedSender('jobs@linkedin.com', config())).toBe(true)
    expect(isExcludedSender('jobs@linkedin.com', config())).toBe(false)
    // Disabled → excluded, not included.
    expect(isExcludedSender('noreply@glassdoor.de', config())).toBe(true)
    expect(isIncludedSender('noreply@glassdoor.de', config())).toBe(false)
  })

  it('treats an unknown sender as neither', () => {
    expect(isIncludedSender('hi@random.io', config())).toBe(false)
    expect(isExcludedSender('hi@random.io', config())).toBe(false)
  })

  it('matches the domain fragment inside a full "Name <addr>" header', () => {
    expect(isIncludedSender('LinkedIn <n@e.linkedin.com>', config())).toBe(true)
  })
})

describe('subjectMatchesKeywords', () => {
  it('matches whole words, case-insensitively', () => {
    expect(subjectMatchesKeywords('Senior ENGINEER wanted', config().keywords)).toBe(true)
    expect(subjectMatchesKeywords('3 neue Stelle in München', config().keywords)).toBe(true)
  })

  it('does not match a substring of a larger word', () => {
    // "engineering" contains "engineer" but is a different word.
    expect(subjectMatchesKeywords('civil engineering degree', ['engineer'])).toBe(false)
  })

  it('is false with no keywords', () => {
    expect(subjectMatchesKeywords('Engineer', [])).toBe(false)
  })
})

describe('validate / resolve', () => {
  it('lowercases, trims and de-dupes domains and keywords', () => {
    const result = validateMailScanConfig({
      domains: [
        { domain: '  LinkedIn.  ', enabled: true },
        { domain: 'linkedin.', enabled: false }, // duplicate — first wins
        { domain: '', enabled: true }, // dropped
      ],
      keywords: ['Engineer', 'engineer', ' '],
    })
    expect('data' in result && result.data).toEqual({
      domains: [{ domain: 'linkedin.', enabled: true }],
      keywords: ['engineer'],
    })
  })

  it('rejects a malformed shape', () => {
    const result = validateMailScanConfig({ domains: 'nope', keywords: [] })
    expect('error' in result).toBe(true)
  })

  it('falls back to defaults for garbage', () => {
    expect(resolveMailScanConfig(null)).toBe(DEFAULT_MAIL_SCAN_CONFIG)
    expect(resolveMailScanConfig({ bad: 1 })).toBe(DEFAULT_MAIL_SCAN_CONFIG)
  })
})
