import type { MailboxAccountInfo, SourceInfo } from '@data'
import { render, screen, userEvent } from '@test-utils'
import { MailboxCard } from './MailboxCard'

const SOURCE: SourceInfo = {
  sourceId: 'mailbox',
  displayName: 'Job-alert inbox',
  homepage: 'https://mail.google.com',
  enabledByDefault: false,
  enabled: false,
  lastSyncAt: null,
  hasKey: false,
  requiresKey: {
    fields: [
      { id: 'email', label: 'Gmail address', hint: 'you@gmail.com', secret: false },
      { id: 'app_password', label: 'App password', hint: 'paste the 16-character code' },
    ],
  },
  attribution: { label: 'Your inbox', required: false },
}

function setup(accounts: MailboxAccountInfo[] = []): {
  onToggle: ReturnType<typeof vi.fn>
  onAddAccount: ReturnType<typeof vi.fn>
  onRemoveAccount: ReturnType<typeof vi.fn>
} {
  const onToggle = vi.fn()
  const onAddAccount = vi.fn()
  const onRemoveAccount = vi.fn()
  render(
    <MailboxCard
      source={{ ...SOURCE, enabled: accounts.length > 0 }}
      accounts={accounts}
      onToggle={onToggle}
      onAddAccount={onAddAccount}
      onRemoveAccount={onRemoveAccount}
    />,
  )
  return { onToggle, onAddAccount, onRemoveAccount }
}

describe('MailboxCard', () => {
  it('shows the guided connect with no accounts yet', () => {
    setup([])
    expect(screen.getByRole('heading', { name: 'Job-alert inbox' })).toBeInTheDocument()
    // Routes through the account chooser so multi-account users pick the inbox.
    const link = screen.getByRole('link', { name: 'Open Google App Passwords' })
    expect(link.getAttribute('href')).toContain('accounts.google.com/AccountChooser')
    expect(link.getAttribute('href')).toContain(
      encodeURIComponent('myaccount.google.com/apppasswords'),
    )
    expect(screen.getByRole('button', { name: 'Add account' })).toBeInTheDocument()
    // No connected accounts yet → no remove buttons.
    expect(screen.queryByRole('button', { name: /^Remove / })).not.toBeInTheDocument()
  })

  it('lists connected accounts, each removable', async () => {
    const user = userEvent.setup()
    const { onRemoveAccount } = setup([{ email: 'one@gmail.com' }, { email: 'two@gmail.com' }])

    expect(screen.getByText('one@gmail.com')).toBeInTheDocument()
    expect(screen.getByText('two@gmail.com')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove two@gmail.com' }))
    expect(onRemoveAccount).toHaveBeenCalledExactlyOnceWith('two@gmail.com')
  })

  it('gates Add account on both fields and forwards the values', async () => {
    const user = userEvent.setup()
    const { onAddAccount } = setup([])

    const add = screen.getByRole('button', { name: 'Add account' })
    expect(add).toBeDisabled()
    await user.type(screen.getByLabelText('Gmail address'), 'new@gmail.com')
    expect(add).toBeDisabled()
    await user.type(screen.getByLabelText('App password'), 'abcd efgh ijkl mnop')
    expect(add).toBeEnabled()

    await user.click(add)
    expect(onAddAccount).toHaveBeenCalledExactlyOnceWith({
      email: 'new@gmail.com',
      app_password: 'abcd efgh ijkl mnop',
    })
  })

  it('renders the Gmail address as a visible text field, password masked', () => {
    setup([])
    expect(screen.getByLabelText('Gmail address')).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('App password')).toHaveAttribute('type', 'password')
  })

  it('toggles the source on', async () => {
    const user = userEvent.setup()
    const { onToggle } = setup([{ email: 'one@gmail.com' }])
    await user.click(screen.getByRole('switch', { name: 'Enable Job-alert inbox' }))
    expect(onToggle).toHaveBeenCalledExactlyOnceWith(false)
  })
})
