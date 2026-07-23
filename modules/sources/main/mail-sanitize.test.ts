// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { expandLinkTag, sanitizeEmailForPrompt } from './mail-sanitize'

describe('sanitizeEmailForPrompt', () => {
  it('replaces every URL with a stable [LINK-n] tag and maps it back', () => {
    const { text, links } = sanitizeEmailForPrompt(
      'Job A (https://trk.example.com/a?x=1) again https://trk.example.com/a?x=1 and B (https://other.example.com/b)',
    )
    expect(text).toBe('Job A ([LINK-1]) again [LINK-1] and B ([LINK-2])')
    expect(links).toEqual({
      'LINK-1': 'https://trk.example.com/a?x=1',
      'LINK-2': 'https://other.example.com/b',
    })
  })

  it('strips invisible padding characters and collapses the space they leave', () => {
    // Soft hyphens, combining grapheme joiners, and a zero-width space — the
    // "͏ ͏ ͏" preview padding from a real Instaffo digest (escapes, so no
    // editor ever silently eats the invisible characters).
    const padded = 'Dein Job\u00ad \u00ad \u00ad wartet \u034f \u034f \u200b auf dich'
    expect(sanitizeEmailForPrompt(padded).text).toBe('Dein Job wartet auf dich')
  })

  it('keeps line structure while collapsing whitespace runs', () => {
    expect(sanitizeEmailForPrompt('a   b\n\n\n   c\t d').text).toBe('a b\nc d')
  })

  // The point of the whole exercise: a tracking-heavy digest shrinks to a
  // fraction of its size, so the prompt window holds listings, not URL noise.
  it('shrinks a tracking-heavy digest by an order of magnitude', () => {
    const url = `https://trk.example.com/ls/click?upn=${'x'.repeat(1_500)}`
    const digest = Array.from({ length: 5 }, (_, i) => `Job ${i} (${url}${i})`).join('\n')
    const { text, links } = sanitizeEmailForPrompt(digest)
    expect(text.length).toBeLessThan(digest.length / 20)
    expect(Object.keys(links)).toHaveLength(5)
  })

  it('passes text without URLs or padding through untouched', () => {
    expect(sanitizeEmailForPrompt('plain text').text).toBe('plain text')
    expect(sanitizeEmailForPrompt('plain text').links).toEqual({})
  })
})

describe('expandLinkTag', () => {
  const links = { 'LINK-1': 'https://example.com/a', 'LINK-12': 'https://example.com/b' }

  it.each([
    ['[LINK-1]', 'https://example.com/a'],
    ['LINK-12', 'https://example.com/b'],
    ['[ link-1 ]', 'https://example.com/a'],
  ])('resolves the cited tag %s', (cited, expected) => {
    expect(expandLinkTag(cited, links)).toBe(expected)
  })

  it.each([['[LINK-99]'], ['https://example.com/a'], ['not a tag'], ['']])(
    'yields null for %s',
    (cited) => {
      expect(expandLinkTag(cited, links)).toBeNull()
    },
  )
})
