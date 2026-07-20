import {
  DEFAULT_SEARCH_PROFILE,
  resolveSearchProfile,
  validateSearchProfile,
} from './search-profile'

describe('validateSearchProfile', () => {
  it('accepts the default profile', () => {
    expect(validateSearchProfile(DEFAULT_SEARCH_PROFILE)).toEqual({
      data: DEFAULT_SEARCH_PROFILE,
    })
  })

  it('rejects an empty keywords list with a path-qualified error', () => {
    const result = validateSearchProfile({ ...DEFAULT_SEARCH_PROFILE, keywords: [] })
    expect('error' in result && result.error).toMatch(/^keywords:/)
  })

  it('rejects an out-of-range radius', () => {
    const result = validateSearchProfile({ ...DEFAULT_SEARCH_PROFILE, radiusKm: 500 })
    expect('error' in result).toBe(true)
  })

  it('rejects unknown remote scopes', () => {
    const result = validateSearchProfile({ ...DEFAULT_SEARCH_PROFILE, remoteScopes: ['mars'] })
    expect('error' in result).toBe(true)
  })
})

describe('resolveSearchProfile', () => {
  it('returns a valid stored profile as-is', () => {
    const stored = { city: 'Berlin', radiusKm: 50, keywords: ['react'], remoteScopes: ['europe'] }
    expect(resolveSearchProfile(stored)).toEqual(stored)
  })

  it('falls back to defaults for invalid input', () => {
    expect(resolveSearchProfile(null)).toEqual(DEFAULT_SEARCH_PROFILE)
    expect(resolveSearchProfile({ city: '' })).toEqual(DEFAULT_SEARCH_PROFILE)
    expect(resolveSearchProfile(undefined)).toEqual(DEFAULT_SEARCH_PROFILE)
  })
})
