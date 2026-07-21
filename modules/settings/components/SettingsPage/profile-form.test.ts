import { clampRadius, parseKeywords } from './profile-form'

describe('parseKeywords', () => {
  it('splits on commas, trims, and drops empties', () => {
    expect(parseKeywords(' react,  node.js, , go ,')).toEqual(['react', 'node.js', 'go'])
  })

  it('returns an empty list for blank input', () => {
    expect(parseKeywords('   ')).toEqual([])
  })

  it('caps the list at 10 keywords', () => {
    const input = Array.from({ length: 14 }, (_, i) => `kw${i}`).join(',')
    expect(parseKeywords(input)).toHaveLength(10)
  })
})

describe('clampRadius', () => {
  it('passes through an in-range integer', () => {
    expect(clampRadius('25')).toBe(25)
  })

  it('clamps above 200 and below 0', () => {
    expect(clampRadius('999')).toBe(200)
    expect(clampRadius('-5')).toBe(0)
  })

  it('rounds fractional input', () => {
    expect(clampRadius('24.6')).toBe(25)
  })

  it('falls back to 0 for non-numeric input', () => {
    expect(clampRadius('abc')).toBe(0)
  })

  it('treats an empty field as 0', () => {
    expect(clampRadius('')).toBe(0)
  })
})
