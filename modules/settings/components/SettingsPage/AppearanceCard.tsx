import type { ThemeVariant } from '@data'
import { useSetTheme, useTheme } from '@data'
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

// Theme is instant-apply localStorage state (useSetTheme), not an
// electron-store setting — no Save button here.
export function AppearanceCard(): ReactElement {
  const theme = useTheme()
  const setTheme = useSetTheme()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Appearance</CardTitle>
        <CardDescription>Dark is the flagship look; system follows macOS.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <Label htmlFor="settings-theme">Theme</Label>
        <Select
          value={theme.data ?? 'dark'}
          onValueChange={(value) => setTheme.mutate(value as ThemeVariant)}
        >
          <SelectTrigger id="settings-theme" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  )
}
