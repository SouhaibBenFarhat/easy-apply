import { buildDedupeKey, cleanText, stripHtml, toIsoOrNull } from './normalize'

describe('buildDedupeKey', () => {
  it('joins normalized company|title|location', () => {
    expect(buildDedupeKey('Acme GmbH', 'Software Engineer (m/w/d)', 'München')).toBe(
      'acme|software engineer|münchen',
    )
  })

  // The research nasty: same employer posted with and without legal suffix.
  it.each([
    ['Haas Zeitarbeit GmbH', 'Haas Zeitarbeit'],
    ['Allianz SE', 'Allianz'],
    ['Siemens AG', 'Siemens'],
    ['Acme Inc.', 'Acme'],
    ['Acme Ltd', 'Acme'],
    ['Haas Zeitarbeit GmbH & Co. KG', 'Haas Zeitarbeit'],
    ['Kulturverein e.V.', 'Kulturverein'],
  ])('company %s collapses to the same key as %s', (withSuffix, without) => {
    expect(buildDedupeKey(withSuffix, 'Dev', null)).toBe(buildDedupeKey(without, 'Dev', null))
  })

  it('never strips a company down to nothing', () => {
    expect(buildDedupeKey('Co', 'Dev', null)).toBe('co|dev|')
    expect(buildDedupeKey('AG', 'Dev', null)).toBe('ag|dev|')
  })

  it.each([
    'Software Engineer (m/w/d)',
    'Software Engineer (w/m/d)',
    'Software Engineer (f/m/d)',
    'Software Engineer (m/f/d)',
    'Software Engineer (m/w/x)',
    'Software Engineer (all genders)',
    'Software Engineer m/w/d',
  ])('title %s keys the same as the bare title', (title) => {
    expect(buildDedupeKey('Acme', title, null)).toBe(
      buildDedupeKey('Acme', 'Software Engineer', null),
    )
  })

  it('collapses punctuation runs to single spaces', () => {
    expect(buildDedupeKey('Acme', 'Senior Back-End Developer', null)).toBe(
      buildDedupeKey('Acme', 'Senior Back End Developer', null),
    )
  })

  it('handles RemoteOK location junk like "Good Night, " without crashing', () => {
    expect(buildDedupeKey('RemoteCo', 'Dev', 'Good Night, ')).toBe('remoteco|dev|good night')
  })

  it('uses an empty segment for a null location hint', () => {
    expect(buildDedupeKey('Acme', 'Dev', null)).toBe('acme|dev|')
  })

  it('preserves unicode umlauts (münchen stays distinct from munchen)', () => {
    const withUmlaut = buildDedupeKey('Acme', 'Dev', 'münchen')
    const without = buildDedupeKey('Acme', 'Dev', 'munchen')
    expect(withUmlaut).toBe('acme|dev|münchen')
    expect(withUmlaut).not.toBe(without)
  })

  it('does not mangle titles that merely contain slashed acronyms', () => {
    expect(buildDedupeKey('Acme', 'CI/CD Platform Engineer', null)).toBe(
      'acme|ci cd platform engineer|',
    )
  })
})

describe('cleanText', () => {
  it.each([
    ['  hello   world  ', 'hello world'],
    ['line\nbreaks\tand\r\nmore', 'line breaks and more'],
    ['nulls\u0000and\u0007bells', 'nulls and bells'],
    ['', ''],
    ['   ', ''],
  ])('cleans %j to %j', (input, expected) => {
    expect(cleanText(input)).toBe(expected)
  })
})

describe('stripHtml', () => {
  it.each([
    ['<p>Hello <b>World</b></p>', 'Hello World'],
    ['a<br>b', 'a b'],
    ['Tom &amp; Jerry', 'Tom & Jerry'],
    ['&lt;script&gt; is text', '<script> is text'],
    ['&quot;quoted&quot; and &#39;single&#39;', '"quoted" and \'single\''],
    ['non&nbsp;breaking', 'non breaking'],
    ['<div class="x">nested <span>tags</span></div>', 'nested tags'],
    ['no markup at all', 'no markup at all'],
  ])('strips %j to %j', (input, expected) => {
    expect(stripHtml(input)).toBe(expected)
  })
})

describe('toIsoOrNull', () => {
  it.each([
    ['ISO string passthrough', '2026-07-20T10:00:00.000Z', '2026-07-20T10:00:00.000Z'],
    ['date-only string', '2026-07-20', '2026-07-20T00:00:00.000Z'],
    ['unix seconds (< 10^12)', 1700000000, '2023-11-14T22:13:20.000Z'],
    ['unix milliseconds', 1700000000000, '2023-11-14T22:13:20.000Z'],
    ['Date instance', new Date('2026-07-20T10:00:00.000Z'), '2026-07-20T10:00:00.000Z'],
    ['invalid Date instance', new Date('nope'), null],
    ['unparseable string', 'not a date', null],
    ['empty string', '', null],
    ['whitespace string', '   ', null],
    ['null', null, null],
    ['undefined', undefined, null],
    ['NaN', Number.NaN, null],
    ['Infinity', Number.POSITIVE_INFINITY, null],
    ['milliseconds beyond the Date range', 9e15, null],
  ])('%s → %j', (_label, input, expected) => {
    expect(toIsoOrNull(input)).toBe(expected)
  })
})
