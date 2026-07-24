import type { MailScanConfig } from '@data'
import { render, screen, userEvent } from '@test-utils'
import { MailFilterCard } from './MailFilterCard'

function config(): MailScanConfig {
  return {
    domains: [
      { domain: 'linkedin.', enabled: true },
      { domain: 'glassdoor.', enabled: false },
    ],
    keywords: ['engineer'],
  }
}

describe('MailFilterCard', () => {
  it('toggles a domain off (hard-exclude) and reports the new config', async () => {
    const onChange = vi.fn()
    render(<MailFilterCard config={config()} onChange={onChange} />)

    await userEvent.setup().click(screen.getByRole('switch', { name: 'Scan linkedin.' }))
    expect(onChange).toHaveBeenCalledWith({
      domains: [
        { domain: 'linkedin.', enabled: false },
        { domain: 'glassdoor.', enabled: false },
      ],
      keywords: ['engineer'],
    })
  })

  it('removes a domain', async () => {
    const onChange = vi.fn()
    render(<MailFilterCard config={config()} onChange={onChange} />)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Remove glassdoor.' }))
    expect(onChange).toHaveBeenCalledWith({
      domains: [{ domain: 'linkedin.', enabled: true }],
      keywords: ['engineer'],
    })
  })

  it('adds a domain, folded and enabled', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<MailFilterCard config={config()} onChange={onChange} />)

    await user.type(screen.getByRole('textbox', { name: 'New domain' }), '  Join.com  ')
    await user.click(screen.getAllByRole('button', { name: /Add/ })[0] as HTMLElement)
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        domains: [
          { domain: 'linkedin.', enabled: true },
          { domain: 'glassdoor.', enabled: false },
          { domain: 'join.com', enabled: true },
        ],
      }),
    )
  })

  it('ignores a duplicate domain', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<MailFilterCard config={config()} onChange={onChange} />)

    await user.type(screen.getByRole('textbox', { name: 'New domain' }), 'LINKEDIN.')
    await user.click(screen.getAllByRole('button', { name: /Add/ })[0] as HTMLElement)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('adds and removes a keyword', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<MailFilterCard config={config()} onChange={onChange} />)

    await user.type(screen.getByRole('textbox', { name: 'New keyword' }), 'Praktikum')
    await user.click(screen.getAllByRole('button', { name: /Add/ })[1] as HTMLElement)
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ keywords: ['engineer', 'praktikum'] }),
    )

    onChange.mockClear()
    await user.click(screen.getByRole('button', { name: 'Remove engineer' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ keywords: [] }))
  })
})
