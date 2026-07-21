// @vitest-environment node
import { decodeProviderConfig, encodeProviderConfig } from './provider-config-codec'

describe('encodeProviderConfig / decodeProviderConfig', () => {
  it('round-trips a flat string map', () => {
    const values = { app_id: 'id-123', app_key: 'key-456' }
    expect(decodeProviderConfig(encodeProviderConfig(values))).toEqual(values)
  })

  it('round-trips an empty config', () => {
    expect(encodeProviderConfig({})).toBe('{}')
    expect(decodeProviderConfig('{}')).toEqual({})
  })

  it('reads null (no stored config) as {}', () => {
    expect(decodeProviderConfig(null)).toEqual({})
  })

  it('degrades invalid JSON to {} instead of throwing', () => {
    expect(decodeProviderConfig('not json {')).toEqual({})
    expect(decodeProviderConfig('')).toEqual({})
    expect(decodeProviderConfig('{"app_id":')).toEqual({})
  })

  it('degrades non-object JSON to {}', () => {
    expect(decodeProviderConfig('"key-456"')).toEqual({})
    expect(decodeProviderConfig('42')).toEqual({})
    expect(decodeProviderConfig('true')).toEqual({})
    expect(decodeProviderConfig('null')).toEqual({})
    expect(decodeProviderConfig('["app_id","app_key"]')).toEqual({})
  })

  it('keeps only string values, dropping everything else', () => {
    const decoded = decodeProviderConfig(
      '{"app_id":"id-123","count":3,"nested":{"a":1},"list":[1],"flag":true,"nil":null}',
    )
    expect(decoded).toEqual({ app_id: 'id-123' })
  })
})
