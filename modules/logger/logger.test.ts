import { createLogger } from './index'

const ISO_PREFIX = /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] /

describe('createLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('routes each level to the matching console method', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logger = createLogger('app')

    logger.debug('d')
    logger.info('i')
    logger.warn('w')
    logger.error('e')

    expect(debugSpy).toHaveBeenCalledTimes(1)
    expect(infoSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })

  it('prefixes messages with an ISO timestamp', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    createLogger('sync').info('started')

    const [formatted] = infoSpy.mock.calls[0] as [string, unknown]
    expect(formatted).toMatch(ISO_PREFIX)
  })

  it('includes the [category] and message after the timestamp', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    createLogger('db').warn('migration pending')

    const [formatted] = warnSpy.mock.calls[0] as [string, unknown]
    expect(formatted).toMatch(/\] \[db\] migration pending$/)
  })

  it('forwards the meta object as the second argument', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const meta = { jobId: 42, source: 'ba' }
    createLogger('data').error('fetch failed', meta)

    expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(ISO_PREFIX), meta)
    expect(errorSpy.mock.calls[0]?.[1]).toBe(meta)
  })

  it('forwards an empty string when meta is missing', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    createLogger('ipc').debug('ping')

    expect(debugSpy).toHaveBeenCalledWith(expect.any(String), '')
  })
})
