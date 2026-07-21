---
name: theming
description: Change colors, elevation, glass, or motion — the theme.config → generate:theme pipeline, validator gates, and the design rules that must not break.
---

# Theming changes

Full reference: `docs/THEMING.md`. This is the workflow + the tripwires.

## Workflow

1. Edit `src/renderer/styles/theme.config.mjs` — roles (hue per role) and
   per-token `{ role, l, c }` for light and dark. This file is the single
   source of truth for color.
2. Run `pnpm generate:theme`. The validator gates the write:
   - `l` in [0,1], `c` in [0,0.4], known role,
   - contrast floors (`foreground`/`background` ≥ 4.5, `foreground-muted` ≥
     3.0),
   - elevation ordering: `background → surface-content → surface →
     surface-raised → header` strictly descending L in light, strictly
     ascending in dark.
3. The script rewrites the `GENERATED:LIGHT` / `GENERATED:DARK` blocks in
   `src/renderer/styles/globals.css` as raw `L C H` triplets. **Never edit
   those blocks by hand** — the next generate clobbers them.
4. Tailwind consumes tokens as `oklch(var(--token) / <alpha-value>)`
   (`tailwind.config.js`), so opacity modifiers (`bg-primary/12`) keep
   working.

`pnpm build` also runs the generator, but run it yourself before eyeballing.

## Rules that must survive any change

- **Elevation inversion:** chrome is darker than the canvas in light mode,
  lighter in dark. The validator enforces the ordering; keep the intent too.
- **No card nesting:** a surface sits only on the level directly beneath it;
  content areas are flat; cards only in the detail pane and Sources page.
- **Copper scarcity:** `primary` appears in exactly five places — selected
  job row, primary button, active nav item, focus ring, salary badge. Adding
  a sixth use is a design regression, not a tweak.
- **Status hues stay spaced from copper:** warning is clearly yellow (hue
  95), never copper-adjacent (hue 60).
- **Glass** (`.glass` / `.glass-overlay` in globals.css): only where content
  scrolls underneath — window header, sticky filter bar, detail-pane header,
  overlays. ≤ 3 simultaneous backdrop-filter layers. `@supports` fallback to
  the solid token must keep working. Never glass on feed rows, cards, or
  static areas.
- **Motion:** tokens 150/200/350ms + `cubic-bezier(0.25,0.1,0.25,1)`; motion
  communicates a state change; nothing loops idle (only `spin-slow` while a
  sync is genuinely running); background-color transitions only inside
  scrolling lists; `prefers-reduced-motion` kills the rest.

## Forbidden patterns

- Raw colors anywhere in components: hex, `rgb()`, Tailwind palette classes
  (`bg-zinc-800`, `text-white`). Semantic tokens only.
- Hand-editing GENERATED blocks in `globals.css`.
- New `backdrop-filter` uses outside the four glass locations.
- `animate-pulse` for skeletons (use the slow 2.5s `animate-skeleton`).
- Transforms or shadow transitions on elements inside virtualized lists.
