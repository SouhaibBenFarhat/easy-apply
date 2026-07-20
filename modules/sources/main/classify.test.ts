import type { WorkMode } from '@sources/shared'
import { type ClassificationInput, classifyRemoteScope, classifyWorkMode } from './classify'

function input(overrides: Partial<ClassificationInput> = {}): ClassificationInput {
  return { title: 'Software Engineer', description: null, locationRaw: '', ...overrides }
}

describe('classifyWorkMode', () => {
  // Explicit flags win over any text heuristic. Note: BA's homeofficemoeglich
  // maps to hybrid/onsite AT THE PROVIDER (§4.4) — it never calls in here.
  it('trusts explicitRemote=true (Arbeitnow remote bool)', () => {
    expect(classifyWorkMode(input({ explicitRemote: true, locationRaw: 'München' }))).toBe('remote')
  })

  it('explicitRemote=true wins even over hybrid text', () => {
    expect(classifyWorkMode(input({ explicitRemote: true, description: 'hybrid setup' }))).toBe(
      'remote',
    )
  })

  it('maps explicitRemote=false with a real location to onsite', () => {
    expect(classifyWorkMode(input({ explicitRemote: false, locationRaw: 'München, Bayern' }))).toBe(
      'onsite',
    )
  })

  it('falls through to the heuristic when explicitRemote=false has no location', () => {
    expect(
      classifyWorkMode(input({ explicitRemote: false, description: 'Homeoffice möglich' })),
    ).toBe('remote')
    expect(classifyWorkMode(input({ explicitRemote: false, locationRaw: '   ' }))).toBe('unknown')
  })

  const heuristic: Array<[string, Partial<ClassificationInput>, WorkMode]> = [
    ['remote in title', { title: 'Software Engineer (Remote)' }, 'remote'],
    ['fully remote', { description: 'This is a fully remote position' }, 'remote'],
    ['100% remote', { description: 'We are 100% remote' }, 'remote'],
    ['remote-first', { description: 'A remote-first company' }, 'remote'],
    ['German Homeoffice keyword', { description: 'Homeoffice möglich' }, 'remote'],
    ['home office spelled out', { description: 'Home Office nach Absprache' }, 'remote'],
    ['remote in location', { locationRaw: 'Remote' }, 'remote'],
    ['hybrid beats remote', { description: 'Hybrid role, 3 days remote per week' }, 'hybrid'],
    ['hybrid alone', { title: 'Platform Engineer (Hybrid)' }, 'hybrid'],
    ['on-site', { description: 'This role is on-site' }, 'onsite'],
    ['onsite unhyphenated', { description: 'onsite in our Munich office' }, 'onsite'],
    ['German vor Ort', { description: 'Arbeit vor Ort in München' }, 'onsite'],
    ['remote beats onsite when both appear', { description: 'remote or on-site' }, 'remote'],
    ['no signals', { title: 'Working Student', locationRaw: 'München' }, 'unknown'],
    [
      'remotely is not remote (word boundary)',
      { description: 'work remotely-adjacent' },
      'unknown',
    ],
  ]

  it.each(heuristic)('%s', (_label, overrides, expected) => {
    expect(classifyWorkMode(input(overrides))).toBe(expected)
  })
})

describe('classifyRemoteScope', () => {
  // Research examples: Remotive candidate_required_location, Himalayas
  // locationRestrictions, WWR <region>.
  it.each([
    ['Anywhere in the World', 'worldwide'],
    ['Worldwide', 'worldwide'],
    ['Global', 'worldwide'],
    ['Germany', 'germany'],
    ['Deutschland', 'germany'],
    ['DACH', 'germany'],
    ['Europe', 'europe'],
    ['EMEA', 'europe'],
    ['EU only', 'europe'],
    ['Germany, Europe', 'germany'], // germany is the most specific bucket
    ['USA', null],
    ['United States', null],
    ['Dachshund Grooming HQ', null], // \bdach\b must not match inside a word
    ['', null],
  ] as Array<[string, ReturnType<typeof classifyRemoteScope>]>)('%j → %j', (location, expected) => {
    expect(classifyRemoteScope(location)).toBe(expected)
  })

  it('returns null for a null candidate location', () => {
    expect(classifyRemoteScope(null)).toBeNull()
  })
})
