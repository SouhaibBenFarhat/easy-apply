// Compiles src/renderer/styles/theme.config.mjs into raw OKLCH channel
// triplets between the GENERATED markers in globals.css.
// Storing bare `L C H` channels (not full colors) lets Tailwind compose
// opacity: `oklch(var(--token) / <alpha-value>)`.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { darkTokens, lightTokens, roles } from '../src/renderer/styles/theme.config.mjs'

const GLOBALS = resolve(import.meta.dirname, '../src/renderer/styles/globals.css')

// Approximate relative luminance from OKLCH lightness (Y ≈ L³) — good enough
// to gate obviously-broken contrast pairs; real review still uses eyes.
const luminance = (l) => l ** 3
const contrast = (l1, l2) => {
  const [hi, lo] = [luminance(l1), luminance(l2)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}

const ELEVATION = ['background', 'surface-content', 'surface', 'surface-raised', 'header']
const CONTRAST_PAIRS = [
  ['foreground', 'background', 4.5],
  ['foreground-muted', 'background', 3.0],
]

function validate(mode, tokens) {
  const errors = []
  for (const [name, t] of Object.entries(tokens)) {
    if (!roles[t.role]) errors.push(`${mode}.${name}: unknown role "${t.role}"`)
    if (t.l < 0 || t.l > 1) errors.push(`${mode}.${name}: l ${t.l} out of [0,1]`)
    if (t.c < 0 || t.c > 0.4) errors.push(`${mode}.${name}: c ${t.c} out of [0,0.4]`)
  }
  for (const [fg, bg, min] of CONTRAST_PAIRS) {
    const ratio = contrast(tokens[fg].l, tokens[bg].l)
    if (ratio < min) errors.push(`${mode}: contrast ${fg}/${bg} ≈ ${ratio.toFixed(2)} < ${min}`)
  }
  const ladder = ELEVATION.map((n) => tokens[n].l)
  const ordered =
    mode === 'light'
      ? ladder.every((l, i) => i === 0 || l < ladder[i - 1])
      : ladder.every((l, i) => i === 0 || l > ladder[i - 1])
  if (!ordered)
    errors.push(
      `${mode}: elevation ordering violated (${ELEVATION.join(' → ')} must be strictly ${
        mode === 'light' ? 'descending' : 'ascending'
      } in L; got ${ladder.join(', ')})`,
    )
  return errors
}

function render(tokens) {
  return Object.entries(tokens)
    .map(([name, t]) => `  --${name}: ${t.l} ${t.c} ${roles[t.role].hue};`)
    .join('\n')
}

function inject(css, marker, block) {
  const start = `/* GENERATED:${marker}:START */`
  const end = `/* GENERATED:${marker}:END */`
  const pattern = new RegExp(
    `${start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
  )
  if (!pattern.test(css)) throw new Error(`Marker pair ${marker} not found in globals.css`)
  return css.replace(pattern, `${start}\n${block}\n  ${end}`)
}

const errors = [...validate('light', lightTokens), ...validate('dark', darkTokens)]
if (errors.length > 0) {
  console.error('theme.config.mjs validation failed:')
  for (const e of errors) console.error(`  ✗ ${e}`)
  process.exit(1)
}

let css = readFileSync(GLOBALS, 'utf8')
css = inject(css, 'LIGHT', render(lightTokens))
css = inject(css, 'DARK', render(darkTokens))
writeFileSync(GLOBALS, css)
console.log(
  `✓ theme generated: ${Object.keys(lightTokens).length} light + ${Object.keys(darkTokens).length} dark tokens`,
)
