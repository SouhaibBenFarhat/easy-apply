---
name: sidebars
description: Elevation model for sidebars and side panels — body sits at background, header/footer are one step up (the main nav takes the top chrome), and sticky in-content headers get a glass-on-scroll veil. Read before building or restyling any sidebar, master list, activity/inspector panel, or a panel with a sticky header.
---

# Sidebars & side panels — the elevation model

A sidebar is a structural container: the primary nav, a master list, an
activity/inspector panel, a detail pane. Get the elevation wrong and two panels
read as one broken slab — the merge bug. This model builds on the ladder in
`docs/THEMING.md`; the border/contrast rules live in the `visual-hierarchy`
skill (headers/footers need `border-border`, never `border-subtle`).

## The rules

1. **Body = `bg-background`.** A sidebar's scrolling body sits at the base
   canvas level — the same as the main content area. **Never `bg-surface`** —
   two sidebars both on `bg-surface` are exactly what makes them merge.
2. **Every sidebar has a header AND a footer.** Structural bookends, even when
   the footer is just a status/count line.
3. **Header + footer are elevated from the body** → `bg-surface-hover` (0.222)
   + a full-strength `border-border` on the dividing edge — ~0.077 above the
   `background` body, a step that clearly reads. (`surface-content` 0.16 is
   ~invisible against `background`; `surface` 0.185 is only ~0.04 — still close.)
   The `header` chrome is raised to 0.35 precisely to leave this headroom
   (`.glass` reads ~0.06 below the raw token, so the header still needs to clear
   surface-hover with room).
4. **The primary app nav sidebar is the exception:** its top strip is the LEFT
   half of the window's header bar, so it uses the **same `.glass` material as
   the app header** — one unified top chrome row. Never solid `bg-header` on the
   strip while the app header is glass: a solid opaque tone always reads *more*
   elevated than the translucent glass beside it, so the nav would outrank the
   app header (the bug). **Its footer can't be glass (blur-layer budget), so
   match the glass strip's *rendered* elevation with a solid `bg-surface-hover`
   (~0.22) — never solid `bg-header` (0.25), which reads higher than the glass
   above it.** Solid vs glass at the "same" token never look equal.
5. **Secondary sidebars** (master list, activity timeline, inspector) use the
   `bg-surface-hover` chrome from rule 3 for their header + footer — **below the
   main nav's chrome, well above the body.** Two sidebars at the same elevation
   is the merge bug; give the main nav the top tone and everything else below.

Resulting hierarchy (dark L): body `background` 0.145 < secondary chrome
`surface-hover` 0.222 < app header + nav strip glass (~0.28, `header` token
0.35) — tones that read clearly apart.

## Sticky in-content headers (detail panes)

A header pinned while its panel scrolls underneath must:
- sit **elevated above** the panel body (`bg-surface-hover`), and
- be a **translucent glass veil of that level** —
  `bg-surface-hover/85` + `backdrop-blur-md` + `border-b border-border` — so
  scrolled content shows through it, signalling there is more underneath.

Not the panel's own tone (that merges), and not fully opaque (you lose the
scroll cue). This is a deliberate deviation from the flat-content rule: a
scrolling detail header earns one step of elevation + glass precisely so the
scroll is legible.

## Checklist

- [ ] Body `bg-background`, not `bg-surface`?
- [ ] Header AND footer present, both `bg-surface-content` + `border-border`?
- [ ] Main nav sidebar on `bg-header` (highest); every secondary sidebar a step
      lower on `bg-surface-content`?
- [ ] No two sidebars sharing an elevation (the merge bug)?
- [ ] Sticky in-content header glassy + one step up, so content scrolls visibly
      under it?
