import { SOURCE_IDS } from '@sources/shared'
// Imported through the barrel so the @sources/main entry point is exercised.
import { getProvider, listProviderMeta, PROVIDERS } from './index'

describe('provider registry', () => {
  it('holds the German anchors, the remote boards, keyed Adzuna, and the mailbox', () => {
    expect(PROVIDERS).toHaveLength(7)
    const ids = ['ba', 'arbeitnow', 'himalayas', 'remoteok', 'wwr', 'adzuna', 'mailbox']
    expect(PROVIDERS.map((provider) => provider.meta.id)).toEqual(ids)
    expect(listProviderMeta().map((meta) => meta.id)).toEqual(ids)
  })

  it('resolves registered ids to their provider', () => {
    for (const provider of PROVIDERS) {
      expect(getProvider(provider.meta.id)?.meta.id).toBe(provider.meta.id)
    }
  })

  it('returns undefined for known source ids that have no provider yet', () => {
    const registered = new Set(PROVIDERS.map((provider) => provider.meta.id))
    for (const id of SOURCE_IDS) {
      if (registered.has(id)) continue
      expect(getProvider(id)).toBeUndefined()
    }
  })
})
