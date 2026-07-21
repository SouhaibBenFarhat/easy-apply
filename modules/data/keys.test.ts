import { createTestQueryClient } from '@test-utils'
import { keys } from './keys'

describe('keys', () => {
  it('prefixes every jobs key with keys.jobs.all (hierarchical invalidation)', () => {
    expect(keys.jobs.feed({}).slice(0, keys.jobs.all.length)).toEqual([...keys.jobs.all])
    expect(keys.jobs.detail('ba:1').slice(0, keys.jobs.all.length)).toEqual([...keys.jobs.all])
  })

  it('embeds the filters in feed keys and the id in detail keys', () => {
    const filters = { search: 'react', hasSalary: true }
    expect(keys.jobs.feed(filters)).toEqual(['jobs', 'feed', filters])
    expect(keys.jobs.detail('ba:1')).toEqual(['jobs', 'detail', 'ba:1'])
  })

  it('puts the persistence namespace at index 0 of every key', () => {
    expect(keys.jobs.all[0]).toBe('jobs')
    expect(keys.sources.list[0]).toBe('sources')
    expect(keys.sync.status[0]).toBe('sync')
    expect(keys.settings.app[0]).toBe('settings')
    expect(keys.settings.theme[0]).toBe('settings')
    expect(keys.local.lastFeedVisit[0]).toBe('local')
  })

  it('invalidating keys.jobs.all reaches feed and detail queries', async () => {
    const client = createTestQueryClient()
    client.setQueryData(keys.jobs.feed({}), [])
    client.setQueryData(keys.jobs.detail('ba:1'), null)
    client.setQueryData(keys.sources.list, [])
    await client.invalidateQueries({ queryKey: keys.jobs.all })
    expect(client.getQueryState(keys.jobs.feed({}))?.isInvalidated).toBe(true)
    expect(client.getQueryState(keys.jobs.detail('ba:1'))?.isInvalidated).toBe(true)
    expect(client.getQueryState(keys.sources.list)?.isInvalidated).toBe(false)
  })
})
