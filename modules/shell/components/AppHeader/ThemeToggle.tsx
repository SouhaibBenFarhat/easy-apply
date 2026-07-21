import type { ThemeVariant } from '@data'
import { Button } from '@ui-kit'
import type { LucideIcon } from 'lucide-react'
import { Monitor, Moon, Sun } from 'lucide-react'
import type { ReactElement } from 'react'

export interface ThemeToggleProps {
  theme: ThemeVariant
  onCycleTheme: () => void
}

const THEME_ICONS: Record<ThemeVariant, LucideIcon> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}

export function ThemeToggle({ theme, onCycleTheme }: ThemeToggleProps): ReactElement {
  const Icon = THEME_ICONS[theme]
  return (
    <Button variant="ghost" size="icon-sm" aria-label="Toggle theme" onClick={onCycleTheme}>
      <Icon />
    </Button>
  )
}
