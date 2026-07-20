import { SOURCE_IDS } from '@sources/shared'
// Imported through the barrel so the @sources/main entry point is exercised.
import { getProvider, listProviderMeta, PROVIDERS } from './index'

describe('provider registry', () => {
  it('starts empty — providers land in PRs 6–8', () => {
    expect(PROVIDERS).toEqual([])
    expect(listProviderMeta()).toEqual([])
  })

  it('returns undefined for every known source id while empty', () => {
    for (const id of SOURCE_IDS) expect(getProvider(id)).toBeUndefined()
  })
})
