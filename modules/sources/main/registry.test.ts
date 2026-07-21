import { SOURCE_IDS } from '@sources/shared'
// Imported through the barrel so the @sources/main entry point is exercised.
import { getProvider, listProviderMeta, PROVIDERS } from './index'

describe('provider registry', () => {
  it('holds the two German anchor providers from PR 6', () => {
    expect(PROVIDERS).toHaveLength(2)
    expect(PROVIDERS.map((provider) => provider.meta.id)).toEqual(['ba', 'arbeitnow'])
    expect(listProviderMeta().map((meta) => meta.id)).toEqual(['ba', 'arbeitnow'])
  })

  it('resolves registered ids to their provider', () => {
    expect(getProvider('ba')?.meta.id).toBe('ba')
    expect(getProvider('arbeitnow')?.meta.id).toBe('arbeitnow')
  })

  it('returns undefined for known source ids that have no provider yet', () => {
    const registered = new Set(PROVIDERS.map((provider) => provider.meta.id))
    for (const id of SOURCE_IDS) {
      if (registered.has(id)) continue
      expect(getProvider(id)).toBeUndefined()
    }
  })
})
