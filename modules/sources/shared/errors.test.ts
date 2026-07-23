import { describeError } from './errors'

describe('describeError', () => {
  it('follows the cause chain so a wrapper cannot hide the real reason', () => {
    // The exact shape that made a failed sync unexplainable: drizzle reports
    // the statement, Postgres reports the actual problem one level down.
    const cause = new Error('duplicate key value violates unique constraint')
    const wrapped = new Error('Failed query: insert into "jobs" …', { cause })
    expect(describeError(wrapped)).toBe(
      'Failed query: insert into "jobs" … ← caused by: duplicate key value violates unique constraint',
    )
  })

  it('clips a huge wrapper message instead of recording 17 KB of SQL', () => {
    const wrapped = new Error(`Failed query: ${'x'.repeat(20_000)}`, { cause: new Error('boom') })
    const described = describeError(wrapped)
    expect(described.length).toBeLessThan(700)
    expect(described).toContain('…')
    expect(described).toContain('boom')
  })

  it('stops at a sane depth on a long chain', () => {
    let error = new Error('root')
    for (const label of ['l3', 'l2', 'l1', 'l0']) error = new Error(label, { cause: error })
    expect(describeError(error).split('← caused by:')).toHaveLength(4)
  })

  it('does not repeat a wrapper that merely echoes its cause', () => {
    const cause = new Error('same')
    expect(describeError(new Error('same', { cause }))).toBe('same')
  })

  it.each([
    ['plain string', 'plain string'],
    [{ code: 'ECONN' }, '{"code":"ECONN"}'],
    [null, 'unknown error'],
    [undefined, 'unknown error'],
  ])('describes the non-Error throw %s', (thrown, expected) => {
    expect(describeError(thrown)).toBe(expected)
  })
})
