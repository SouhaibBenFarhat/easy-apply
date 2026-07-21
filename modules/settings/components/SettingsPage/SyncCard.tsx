import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui-kit'
import type { ReactElement } from 'react'

export interface SyncCardProps {
  intervalHours: number
  onChange: (hours: number) => void
}

const INTERVALS: readonly number[] = [1, 3, 6, 12, 24]

// Interval saves immediately on change — a dropdown pick is already an
// explicit decision, no Save button needed.
export function SyncCard({ intervalHours, onChange }: SyncCardProps): ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sync</CardTitle>
        <CardDescription>How often every enabled source is polled.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <Label htmlFor="settings-sync-interval">Sync interval</Label>
        <Select value={String(intervalHours)} onValueChange={(value) => onChange(Number(value))}>
          <SelectTrigger id="settings-sync-interval" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INTERVALS.map((hours) => (
              <SelectItem key={hours} value={String(hours)}>
                {hours === 1 ? 'Every hour' : `Every ${hours} hours`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  )
}
