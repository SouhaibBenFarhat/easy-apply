import { useSyncEventInvalidation, useTheme } from '@data'

// Renders nothing: applies the persisted theme class on mount (and tracks OS
// appearance while in 'system'), and re-reads jobs/status/sources after every
// completed background sync pass.
export function ThemeManager(): null {
  useTheme()
  useSyncEventInvalidation()
  return null
}
