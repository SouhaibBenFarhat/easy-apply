---
name: ui-kit
description: Add or extend a component in modules/ui-kit — folder layout, CVA variant pattern, token rules, test expectations, barrel export.
---

# Adding a ui-kit component

`modules/ui-kit/` is L1: it may import `@logger` and other ui-kit files only —
never `@data`, never features. Check the barrel (`modules/ui-kit/index.ts`)
first; extend an existing component before adding a new one.

## Folder layout

One folder per component, PascalCase files:

```
modules/ui-kit/<kebab-name>/
├─ <PascalName>.tsx        # the component (one component per file)
├─ <PascalName>.test.tsx   # co-located test
└─ index.ts                # barrel: export the component + its prop types
```

Then add `export * from './<kebab-name>'` to `modules/ui-kit/index.ts`
(alphabetical order).

## Component pattern

Follow `modules/ui-kit/button/Button.tsx`:

- Radix primitive where one exists (Dialog, Popover, Select, Tabs, Switch,
  Tooltip, …), plain elements otherwise.
- **CVA for variants, with explicit unions** — `isolatedDeclarations` forbids
  `VariantProps<typeof x>` in exported types:

  ```tsx
  export type BadgeVariant = 'default' | 'success' | 'warning' | 'destructive' | 'info'

  const badgeVariants = cva('...base classes...', {
    variants: { variant: { default: '...', success: '...' } },
    defaultVariants: { variant: 'default' },
  })

  export interface BadgeProps extends ComponentProps<'span'> {
    variant?: BadgeVariant
  }

  export function Badge({ className, variant, ...props }: BadgeProps): ReactElement { … }
  ```

- Merge classes with `cn()` from `../utils` (clsx + tailwind-merge), caller
  `className` last.
- **Semantic tokens only** — `bg-surface`, `text-foreground-muted`,
  `border-border-subtle`, status quads (`success`/`-subtle`/`-border`), never
  raw Tailwind palette colors. Copper (`primary`) only for the five allowed
  uses (see CLAUDE.md).
- Buttons default `type="button"` (see Button.tsx's `type ?? 'button'`).
- Explicit return types (`: ReactElement`) on every export.
- Sizes/radii from the scale: controls `h-9`, radius tokens
  `rounded-sm/rounded/rounded-lg`, motion via the named durations — nothing
  bespoke.
- Keep it small: split at ~150 lines or one responsibility.

## Test expectations

Co-located `<Name>.test.tsx`, rendered through `@test-utils` (its `render`
wires QueryClient + Tooltip providers). Cover:

- renders with role/accessible name,
- each variant applies its distinguishing class,
- interaction behavior (click/keyboard) where any exists,
- `className` pass-through merges.

Run `pnpm test` — coverage gates are 85% global, 90% on changed lines in CI.
