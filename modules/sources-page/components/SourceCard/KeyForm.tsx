import type { SourceInfo } from '@data'
import { Button, Input, Label } from '@ui-kit'
import type { ReactElement } from 'react'
import { useState } from 'react'

export interface KeyFormProps {
  sourceId: string
  fields: NonNullable<SourceInfo['requiresKey']>['fields']
  onSave: (values: Record<string, string>) => void
  /** Submit-button label — defaults to "Save key". */
  saveLabel?: string
}

// Credential entry for a keyed source: one input per declared field, masked
// unless the field is explicitly non-secret (secret === false, e.g. an email
// address). Values only ever travel outward through onSave — nothing is echoed
// back from the main process (SourceInfo carries hasKey, not the key).
export function KeyForm({
  sourceId,
  fields,
  onSave,
  saveLabel = 'Save key',
}: KeyFormProps): ReactElement {
  const [values, setValues] = useState<Record<string, string>>({})
  const complete = fields.every((field) => (values[field.id] ?? '').trim() !== '')

  return (
    <div className="space-y-3">
      {fields.map((field) => {
        const inputId = `${sourceId}-key-${field.id}`
        return (
          <div key={field.id} className="space-y-1.5">
            <Label htmlFor={inputId}>{field.label}</Label>
            <Input
              id={inputId}
              type={field.secret === false ? 'text' : 'password'}
              placeholder={field.hint}
              value={values[field.id] ?? ''}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, [field.id]: event.target.value }))
              }
            />
          </div>
        )
      })}
      <Button size="sm" disabled={!complete} onClick={() => onSave(values)}>
        {saveLabel}
      </Button>
    </div>
  )
}
