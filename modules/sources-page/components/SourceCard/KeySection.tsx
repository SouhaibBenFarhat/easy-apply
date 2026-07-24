import type { SourceInfo } from '@data'
import { Badge, Button } from '@ui-kit'
import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { KeyForm } from './KeyForm'
import { MailboxGuide } from './MailboxGuide'

export interface KeySectionProps {
  source: SourceInfo
  onSaveKey: (values: Record<string, string>) => void
  onClearKey: () => void
}

// How long the armed "Confirm clear" state stays live before disarming.
const CLEAR_ARM_MS = 3000

// Key management for a keyed source: a configured row (replace / clear) when
// a key is stored, the entry form when there is none or a replacement is
// underway.
export function KeySection({ source, onSaveKey, onClearKey }: KeySectionProps): ReactElement {
  const [replacing, setReplacing] = useState(false)
  const [clearArmed, setClearArmed] = useState(false)

  // Inline two-step confirm instead of a dialog: the first click only arms
  // the button (it turns destructive "Confirm clear"); a second click while
  // armed actually clears, and this timeout quietly disarms otherwise.
  useEffect(() => {
    if (!clearArmed) return undefined
    const timer = setTimeout(() => setClearArmed(false), CLEAR_ARM_MS)
    return () => clearTimeout(timer)
  }, [clearArmed])

  const handleClear = (): void => {
    if (!clearArmed) {
      setClearArmed(true)
      return
    }
    setClearArmed(false)
    onClearKey()
  }

  return (
    <div className="space-y-3 border-t border-border-subtle pt-3">
      {source.hasKey ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">API key configured</span>
          <Badge variant="success">configured</Badge>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setReplacing((open) => !open)}>
              Replace key
            </Button>
            <Button variant={clearArmed ? 'destructive' : 'ghost'} size="sm" onClick={handleClear}>
              {clearArmed ? 'Confirm clear' : 'Clear'}
            </Button>
          </div>
        </div>
      ) : null}
      {!source.hasKey || replacing ? (
        <>
          {source.sourceId === 'mailbox' ? <MailboxGuide /> : null}
          <KeyForm
            sourceId={source.sourceId}
            fields={source.requiresKey?.fields ?? []}
            saveLabel={source.sourceId === 'mailbox' ? 'Connect' : 'Save key'}
            onSave={(values) => {
              // Collapse the replacement form immediately; the sources query
              // invalidation confirms the new key state.
              setReplacing(false)
              onSaveKey(values)
            }}
          />
        </>
      ) : null}
    </div>
  )
}
