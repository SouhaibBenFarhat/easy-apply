// Single source of truth for the color system — the VZ5 palette (PLAN.md §5.1).
// Matte dark petrol blue dominant (neutral hue 215, real chroma on dark
// surfaces), copper as the single scarce accent (primary hue 60), status hues
// spaced away from copper. Dark mode is the flagship and default theme.
// Edit values here, then run `pnpm generate:theme` — never edit the GENERATED
// blocks in globals.css by hand.

export const roles = {
  neutral: { hue: 215 },
  primary: { hue: 60 },
  success: { hue: 155 },
  warning: { hue: 95 },
  destructive: { hue: 27 },
  info: { hue: 230 },
}

// Elevation rule (validated by the generator):
// light mode — higher elevation is DARKER (background is the lightest thing on screen)
// dark mode  — higher elevation is LIGHTER (background is the darkest)
export const lightTokens = {
  background: { role: 'neutral', l: 1.0, c: 0 },
  'surface-content': { role: 'neutral', l: 0.978, c: 0.006 },
  surface: { role: 'neutral', l: 0.958, c: 0.008 },
  'surface-raised': { role: 'neutral', l: 0.944, c: 0.01 },
  'surface-hover': { role: 'neutral', l: 0.93, c: 0.011 },
  header: { role: 'neutral', l: 0.85, c: 0.012 },
  overlay: { role: 'neutral', l: 1.0, c: 0 },
  foreground: { role: 'neutral', l: 0.175, c: 0.015 },
  'foreground-muted': { role: 'neutral', l: 0.47, c: 0.015 },
  'foreground-subtle': { role: 'neutral', l: 0.6, c: 0.012 },
  'foreground-ghost': { role: 'neutral', l: 0.7, c: 0.01 },
  border: { role: 'neutral', l: 0.86, c: 0.012 },
  'border-muted': { role: 'neutral', l: 0.89, c: 0.01 },
  'border-subtle': { role: 'neutral', l: 0.92, c: 0.008 },
  'interactive-hover': { role: 'neutral', l: 0.93, c: 0.012 },
  'interactive-active': { role: 'neutral', l: 0.9, c: 0.014 },
  primary: { role: 'primary', l: 0.55, c: 0.12 },
  'primary-foreground': { role: 'neutral', l: 0.995, c: 0 },
  input: { role: 'neutral', l: 0.958, c: 0.008 },
  ring: { role: 'primary', l: 0.55, c: 0.12 },
  success: { role: 'success', l: 0.52, c: 0.12 },
  'success-foreground': { role: 'neutral', l: 0.995, c: 0 },
  'success-subtle': { role: 'success', l: 0.95, c: 0.03 },
  'success-border': { role: 'success', l: 0.85, c: 0.06 },
  warning: { role: 'warning', l: 0.65, c: 0.12 },
  'warning-foreground': { role: 'neutral', l: 0.2, c: 0.01 },
  'warning-subtle': { role: 'warning', l: 0.96, c: 0.04 },
  'warning-border': { role: 'warning', l: 0.87, c: 0.08 },
  destructive: { role: 'destructive', l: 0.55, c: 0.18 },
  'destructive-foreground': { role: 'neutral', l: 0.995, c: 0 },
  'destructive-subtle': { role: 'destructive', l: 0.95, c: 0.03 },
  'destructive-border': { role: 'destructive', l: 0.86, c: 0.08 },
  info: { role: 'info', l: 0.55, c: 0.14 },
  'info-foreground': { role: 'neutral', l: 0.995, c: 0 },
  'info-subtle': { role: 'info', l: 0.95, c: 0.03 },
  'info-border': { role: 'info', l: 0.86, c: 0.07 },
}

export const darkTokens = {
  background: { role: 'neutral', l: 0.145, c: 0.03 },
  'surface-content': { role: 'neutral', l: 0.16, c: 0.031 },
  surface: { role: 'neutral', l: 0.185, c: 0.032 },
  'surface-raised': { role: 'neutral', l: 0.202, c: 0.034 },
  'surface-hover': { role: 'neutral', l: 0.222, c: 0.035 },
  // One step above surface-raised — a quiet chrome strip, not a glowing slab.
  header: { role: 'neutral', l: 0.25, c: 0.036 },
  overlay: { role: 'neutral', l: 0.275, c: 0.033 },
  foreground: { role: 'neutral', l: 0.96, c: 0.005 },
  'foreground-muted': { role: 'neutral', l: 0.625, c: 0.015 },
  'foreground-subtle': { role: 'neutral', l: 0.52, c: 0.015 },
  'foreground-ghost': { role: 'neutral', l: 0.42, c: 0.015 },
  border: { role: 'neutral', l: 0.29, c: 0.02 },
  'border-muted': { role: 'neutral', l: 0.245, c: 0.018 },
  'border-subtle': { role: 'neutral', l: 0.215, c: 0.016 },
  'interactive-hover': { role: 'neutral', l: 0.24, c: 0.02 },
  'interactive-active': { role: 'neutral', l: 0.27, c: 0.022 },
  primary: { role: 'primary', l: 0.68, c: 0.13 },
  'primary-foreground': { role: 'neutral', l: 0.13, c: 0.01 },
  // Recessed well — text fields sit BELOW every container they appear in
  // (bar 0.185, cards 0.202), the dark-mode mirror of light-mode gray fields.
  input: { role: 'neutral', l: 0.128, c: 0.028 },
  ring: { role: 'primary', l: 0.68, c: 0.13 },
  success: { role: 'success', l: 0.7, c: 0.13 },
  'success-foreground': { role: 'neutral', l: 0.13, c: 0.005 },
  'success-subtle': { role: 'success', l: 0.25, c: 0.04 },
  'success-border': { role: 'success', l: 0.38, c: 0.07 },
  warning: { role: 'warning', l: 0.75, c: 0.13 },
  'warning-foreground': { role: 'neutral', l: 0.13, c: 0.005 },
  'warning-subtle': { role: 'warning', l: 0.26, c: 0.04 },
  'warning-border': { role: 'warning', l: 0.4, c: 0.08 },
  destructive: { role: 'destructive', l: 0.62, c: 0.17 },
  'destructive-foreground': { role: 'neutral', l: 0.995, c: 0 },
  'destructive-subtle': { role: 'destructive', l: 0.24, c: 0.05 },
  'destructive-border': { role: 'destructive', l: 0.38, c: 0.09 },
  info: { role: 'info', l: 0.65, c: 0.13 },
  'info-foreground': { role: 'neutral', l: 0.13, c: 0.005 },
  'info-subtle': { role: 'info', l: 0.25, c: 0.04 },
  'info-border': { role: 'info', l: 0.39, c: 0.08 },
}
