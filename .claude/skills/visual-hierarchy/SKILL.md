---
name: visual-hierarchy
description: Give UI groups real edges and surface contrast — pick the right border/surface token so content stops reading as a flat, edgeless paragraph. Read before styling lists, rows, chips, grouped sections, or any "unflatten this / fix contrast" request.
---

# Visual hierarchy — edges and surface contrast

The failure this prevents: content inside a card or panel reads as **one flat,
edgeless paragraph** — grouped items blur together, "there are no edges." It
happens when you reach for `border-subtle` to outline an element, or stack
content with no surface shift. Full token pipeline + design laws:
`docs/THEMING.md` and the `theming` skill. This is the practical playbook.

## Why "no edges" happens (the root cause)

Borders are semantic tokens, and their contrast is deliberately tiered. In dark
mode the L values are roughly:

| Token | Dark L | Job |
|---|---|---|
| `bg-surface-raised` (Card) | 0.202 | the base a card's content sits on |
| `border-subtle` | 0.215 | hairline divider **only** — a whisper |
| `border-muted` | 0.245 | secondary divider |
| `border` (`border-border`) | 0.29 | the **visible edge** of a distinct element |

`border-subtle` (0.215) on a `surface-raised` card (0.202) is a **0.013**
lightness difference — invisible. That is the bug. `border-border` (0.29) on the
same card is **0.088** — a real edge. **Never use `border-subtle` to outline an
element you want the user to see as distinct.** It is for hairline row dividers
in flat scrolling lists (feed rows), where faintness is the point.

## Know your base surface first

Contrast is relative to what the element sits on:

- **Card** → `bg-surface-raised` (0.202)
- **Sidebar / panels** → `bg-surface` (0.185)
- **Page canvas** → `bg-background` (0.145)
- **Inputs** → `bg-input` (recessed well)

The elevation ladder (dark = lighter is higher): `background → surface-content →
surface → surface-raised → surface-hover → header/overlay`.

## The recipe for a distinct item/group inside a container

To make rows, chips, or a grouped section pop instead of flatten:

1. **Shift the surface** one step off the base — recessed (darker) reads as an
   inset well, raised (lighter) reads as a lifted chip. Inside a `surface-raised`
   card, `bg-surface-content` (0.16) is a clean recess; `bg-surface-hover`
   (0.222) is a subtle lift.
2. **Add a real border** — `border border-border`, not `border-subtle`.
3. **Round it** — `rounded-lg` (or `rounded`).
4. **Label the group** — a `label-caps` micro-caps header ("Connected accounts")
   turns a stack into a section.

Worked example — the connected-accounts row on the mailbox card:

```tsx
// Recessed one step below the card + full-strength border = clear edges.
<li className="flex items-center gap-2 rounded-lg border border-border bg-surface-content px-3 py-2.5">
  <span className="min-w-0 flex-1 truncate text-sm font-medium">{email}</span>
  <Badge variant="success">connected</Badge>
  …
</li>
```

## Buttons on elevated surfaces

Same trap: `ghost` and `outline` buttons have a **transparent fill**, so on a
raised card (`surface-raised`) their interior is the card colour and they visually
merge — the border is a hairline drawn on the surface, not a control.

- On a **card/panel**, a secondary action uses the **`secondary`** Button
  variant — a neutral filled control (`bg-surface-hover` + `border-border` +
  `shadow-elevation-low`) that lifts off any surface. Not copper (`primary` is
  scarce — 5 uses only), not transparent.
- `ghost` is for genuinely quiet, hover-reveal actions (icon buttons in a row);
  don't use it as the main action on a card.
- `outline` is fine on the flat page canvas; it's the one that merges on
  elevated surfaces — reach for `secondary` there.

## Headers and footers need contrast from the body

A header strip or footer *inside a panel* (sidebar, card, detail pane) must read
as its own chrome, not melt into the panel body. This is a repeat offender —
`border-subtle` on the same surface as the body = invisible seam.

Give a header/footer **both**:
1. A **clearly-lighter chrome tone** — not the timid adjacent step. In dark mode
   chrome is lighter, and one step (`surface` → `surface-raised`, ~0.017 L) is
   too subtle to read. Jump to the **`header`** chrome tone (or `surface-hover`
   at minimum) so the tone itself carries contrast, matching the app header.
2. A **full-strength border** on the dividing edge — `border-b`/`border-t
   border-border`, never `border-subtle`.

Worked example — the sidebar (`bg-surface`): its top strip and footer are
`bg-header` + `border-border`, so both read as distinct chrome. `border-subtle`
on the body surface, or a barely-lighter `surface-raised`, is the bug.

## Guardrails (these still hold)

- **No card nesting.** A bordered recessed row/well is *not* a nested `Card` —
  it is a surface one adjacent step down, which is allowed. Do not put a `Card`
  inside a `Card`.
- **A surface sits only on the level directly beneath it** — don't skip the
  ladder for a cheap contrast hit; step one level (`surface-raised` →
  `surface-content` is the recess used above and reads correctly).
- **Semantic tokens only** — never raw colors, never `border-white/10` or a hex.
- Depth comes from **surface + border + radius + a label**, not from shadows on
  static content (shadows are for the elevation ladder and overlays only).

## Checklist before shipping a grouped/list UI

- [ ] Does each item have a **visible** edge? (`border-border`, not `-subtle`.)
- [ ] Is there a **surface shift** from the base, or does it blend in?
- [ ] Is the group **labelled** (`label-caps`) so it reads as a section?
- [ ] Did you avoid nesting a `Card` in a `Card` and stay on adjacent ladder
      levels?
- [ ] Does every header strip / footer have a **surface shift + `border-border`**
      from its panel body (not `border-subtle`)?
