import type { MailboxAccountInfo, SourceInfo } from '@data'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  formatRelativeTime,
  Switch,
} from '@ui-kit'
import { ExternalLink, X } from 'lucide-react'
import type { ReactElement } from 'react'
import { KeyForm } from '../SourceCard/KeyForm'
import { MailboxGuide } from '../SourceCard/MailboxGuide'

export interface MailboxCardProps {
  source: SourceInfo
  accounts: MailboxAccountInfo[]
  onToggle: (enabled: boolean) => void
  onAddAccount: (values: Record<string, string>) => void
  onRemoveAccount: (email: string) => void
}

// The Job-alert inbox card: unlike the generic keyed SourceCard, it manages a
// LIST of connected Google accounts — each row removable, plus a guided
// add-account form. Presentational: every effect comes in as a callback from
// the SourcesPage orchestrator.
export function MailboxCard({
  source,
  accounts,
  onToggle,
  onAddAccount,
  onRemoveAccount,
}: MailboxCardProps): ReactElement {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-1 space-y-0">
        <CardTitle className="text-base">{source.displayName}</CardTitle>
        <Button asChild variant="ghost" size="icon-sm" aria-label={`Open ${source.displayName}`}>
          {/* Intercepted by the window guards → shell.openExternal (§4.9). */}
          <a href={source.homepage} target="_blank" rel="noreferrer">
            <ExternalLink />
          </a>
        </Button>
        <Switch
          className="ml-auto"
          checked={source.enabled}
          onCheckedChange={onToggle}
          aria-label={`Enable ${source.displayName}`}
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="label-caps">
          {source.lastSyncAt === null
            ? 'Never synced'
            : `Synced ${formatRelativeTime(source.lastSyncAt)}`}
          {' · '}
          {source.attribution.label}
        </p>

        {accounts.length > 0 ? (
          <div className="space-y-1.5">
            <p className="label-caps">Connected accounts</p>
            <ul className="space-y-2">
              {accounts.map((account) => (
                <li
                  key={account.email}
                  // Recessed surface one step below the card (surface-content on
                  // surface-raised) + a full-strength border: each account gets
                  // clear edges and contrast instead of reading as a paragraph.
                  className="flex items-center gap-2 rounded-lg border border-border bg-surface-content px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {account.email}
                  </span>
                  <Badge variant="success">connected</Badge>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove ${account.email}`}
                    onClick={() => onRemoveAccount(account.email)}
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="space-y-3 border-t border-border-subtle pt-4">
          <p className="label-caps">{accounts.length > 0 ? 'Add another inbox' : 'Add an inbox'}</p>
          <MailboxGuide />
          <KeyForm
            // Remount (clearing the fields) once an add succeeds and the list
            // grows; a failed add leaves the typed values in place.
            key={accounts.length}
            sourceId="mailbox"
            fields={source.requiresKey?.fields ?? []}
            saveLabel="Add account"
            onSave={onAddAccount}
          />
        </div>
      </CardContent>
    </Card>
  )
}
