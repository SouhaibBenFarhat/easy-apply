# Theming

The design language is "quiet Apple tool, VZ5 palette": matte dark petrol blue
as the dominant material, copper as the single warm accent, glass only where
content scrolls under chrome. Dark mode is the flagship and the default theme;
light mode is a petrol-tinted derivation of the same system.

## Token pipeline

Semantic tokens only — components never use raw colors.

1. **Edit** `src/renderer/styles/theme.config.mjs` — roles (per-role hue) plus
   per-token `{ role, l, c }` OKLCH values for light and dark.
2. **Generate** with `pnpm generate:theme` (`scripts/generate-theme.mjs`). The
   generator *validates first* — value ranges, foreground/background contrast
   floors, and strict elevation ordering — and exits non-zero on violation.
3. It writes raw `L C H` triplets between the `/* GENERATED:LIGHT */` and
   `/* GENERATED:DARK */` markers in `src/renderer/styles/globals.css`. Never
   edit those blocks by hand.
4. **Tailwind consumes** the channels in `tailwind.config.js` as
   `oklch(var(--token) / <alpha-value>)`, so `bg-primary/12` composes opacity
   for free.

`pnpm build` runs the generator automatically; after editing the config
locally, run it yourself before eyeballing the app. Theme preference persists
under the localStorage key `easyapply-theme` (light/dark/system, dark
default).

## The VZ5 palette

Roles (hue per role, from `theme.config.mjs`):

| Role | Hue | Reads as |
|---|---|---|
| `neutral` | 215 | petrol blue (real chroma on dark surfaces, a whisper on light) |
| `primary` | 60 | copper |
| `success` | 155 | green |
| `warning` | 95 | clearly yellow — never copper-adjacent |
| `destructive` | 27 | red-orange |
| `info` | 230 | cyan-blue, distinct from the surface petrol |

Key token values (`{ l, c }`; full set in `theme.config.mjs`):

| Token | Light | Dark | Notes |
|---|---|---|---|
| `background` | 1.000 / 0 | 0.145 / 0.030 | near-black petrol in dark |
| `surface-content` | 0.978 / 0.006 | 0.160 / 0.031 | |
| `surface` | 0.958 / 0.008 | 0.185 / 0.032 | panels, sidebar |
| `surface-raised` | 0.944 / 0.010 | 0.202 / 0.034 | |
| `surface-hover` | 0.930 / 0.011 | 0.222 / 0.035 | |
| `header` | 0.850 / 0.012 | 0.310 / 0.036 | app chrome; glass sits on this |
| `overlay` | 1.000 / 0 | 0.275 / 0.033 | popovers, dialogs |
| `foreground` | 0.175 / 0.015 | 0.960 / 0.005 | |
| `foreground-muted` | 0.470 / 0.015 | 0.625 / 0.015 | |
| `foreground-subtle` | 0.600 / 0.012 | 0.520 / 0.015 | |
| `foreground-ghost` | 0.700 / 0.010 | 0.420 / 0.015 | |
| `border` / `-muted` / `-subtle` | 0.86 / 0.89 / 0.92 | 0.29 / 0.245 / 0.215 | borders separate in light mode |
| `interactive-hover` | 0.930 / 0.012 | 0.240 / 0.020 | |
| `interactive-active` | 0.900 / 0.014 | 0.270 / 0.022 | |
| `primary` (= `ring`) | 0.550 / 0.120 | 0.680 / 0.130 | copper, per-mode pair |
| `success` | 0.520 / 0.120 | 0.700 / 0.130 | + `-foreground/-subtle/-border` quad |
| `warning` | 0.650 / 0.120 | 0.750 / 0.130 | + quad |
| `destructive` | 0.550 / 0.180 | 0.620 / 0.170 | + quad |
| `info` | 0.550 / 0.140 | 0.650 / 0.130 | + quad |

In dark mode chroma rises slightly with elevation (deepest layers blackest,
raised layers bluest) — that is what makes the chrome read as *material*
rather than tinted grey.

## Elevation ladder + inversion rule

Elevated chrome is **darker in light mode and lighter in dark mode** — the
background is always the extreme:

| Surface | Light L | Dark L |
|---|---|---|
| `background` | **1.000** — lightest | **0.145** — darkest |
| `surface-content` | 0.978 | 0.160 |
| `surface` | 0.958 | 0.185 |
| `surface-raised` | 0.944 | 0.202 |
| `header` | **0.850** — darkest chrome | **0.310** — lightest |
| `overlay` | back to 1.000 | 0.275 |

The generator enforces the ordering (strictly descending L in light, strictly
ascending in dark, `background → surface-content → surface → surface-raised →
header`). Borders do the separation work in light mode; the theme-varied
`--shadow-elevation-low/medium/high` shadows roughly triple in strength in
dark (`globals.css`).

**No card nesting.** A surface may only sit on the level directly beneath it.
Content areas are flat; cards are reserved for the detail pane and the Sources
page, never nested inside other cards. Feed rows are flat ListMenu-style rows
(hairline `border-b border-border-subtle`, `hover:bg-interactive-hover`) —
not floating cards.

## Copper scarcity

Copper is the wheel accent: if it is everywhere, it is nowhere. It may appear
in exactly five places:

1. the selected job row (`primary/0.12` fill + primary border),
2. the primary button,
3. the active nav item,
4. the focus ring,
5. the salary figure — plain copper *text*, never a chip; the one warm data
   point in the feed.

Everything else is petrol/neutral. Status colors map as: applied = `success`,
interview = `info`, interested = `warning`, rejected = `destructive` — all
hue-spaced away from copper so it stays unmistakable.

## Glass

One recipe, defined in `globals.css`: `.glass` = `oklch(var(--header) / 0.66)`
+ `backdrop-filter: saturate(180%) blur(24px)` + a 1px inset top highlight
(`white/0.06`) + hairline `border-b border-border-subtle`. Overlays use
`.glass-overlay` (`overlay/0.85` + `blur(20px)`). A `@supports not
(backdrop-filter: …)` fallback drops to the solid token.

**Glass appears in exactly two places:**

1. the window header bar (traffic-light zone),
2. overlays — dialogs, popovers, toasts (`.glass-overlay`).

**Sticky in-content headers are NOT glass.** The feed filter bar is a solid
`bg-surface` ladder step; the detail-pane header is a translucent veil of its
*own* level (`bg-background/90 backdrop-blur-md`) so content fades under it
without a brighter slab. Rationale: `.glass` carries the `--header` token —
painting large or stacked regions with the brightest chrome tone breaks the
elevation ladder and reads as glowing panels (the v0.1.0 lesson).

**Never glass:** feed rows, cards, the sidebar at rest, any large static area
— blur everywhere reads as mud and costs GPU. Hard budget: **at most 3
simultaneous `backdrop-filter` layers** on screen.

## Motion choreography

Tokens (in `globals.css` / `tailwind.config.js`): `--duration-fast` 150ms /
`--duration` 200ms / `--duration-slow` 350ms, ease
`cubic-bezier(0.25, 0.1, 0.25, 1)`, `active:scale-[0.97]` on press, 3px
`primary/0.4` focus ring. Named animations: `fade-in`, `fade-out`, `rise-in`,
`scale-in`, `slide-in-from-bottom`, `spin-slow`, and the slow 2.5s `skeleton`
opacity pulse (never `animate-pulse`).

What animates, and when:

- **Entrances:** first feed paint = staggered fade + 4px rise on the first
  ~10 visible rows (30ms steps) — once per app launch, never on refresh,
  filter change, or scroll.
- **Selection:** the detail pane crossfades on job change (100ms out, 150ms
  in; no slide, no layout shift). Skeleton → content is a 200ms opacity swap
  — the anti-flash rule made visible.
- **Overlays:** dialogs `scale(0.96)→1` + fade, 200ms in / 150ms out;
  popovers and tooltips fade + 2px shift at 150ms; toasts slide in from the
  bottom and fade out at 350ms.
- **State changes:** the "new jobs" divider fades in; the sync icon rotates
  while syncing (`spin-slow` — the only looping animation, and only while
  genuinely active); status-badge color crossfades at 150ms; hiding a job
  collapses height at 200ms + fade.
- **Inside scrolling lists: background-color transitions only** — no
  transforms, no shadows on hover, nothing animating during scroll or
  virtualizer recycling.
- **`prefers-reduced-motion`:** entrances and scale effects off, swaps become
  instant (`globals.css` media query); only essential-feedback opacity
  remains.

Rule of thumb: *motion communicates a state change; nothing loops idle,
nothing bounces, nothing moves that the user didn't cause.*
