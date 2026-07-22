// Renders site/og.png — the 1200×630 card LinkedIn, Slack, X and iMessage show
// when the site URL is shared (and what LinkedIn's Featured section displays).
// Same resvg pipeline as make-icon.mjs.
//
// It has to read at roughly 500px wide, which is how large a Featured card
// actually renders — so this is a DELIBERATELY reduced version of the page's
// architecture graph: four big rungs instead of two lanes and seven nodes,
// beside a simplified app window. Detail that survives on the site turns to
// mud here.
//
// Run: node scripts/make-og.mjs
import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Resvg } from '@resvg/resvg-js'

const SITE_DIR = resolve(import.meta.dirname, '../site')
const OUT = join(SITE_DIR, 'og.png')

const W = 1200
const H = 630

// The VZ5 palette, matching site/index.html's dark scheme.
const BG = '#10171d'
const PANEL = '#16212b'
const LINE = '#223240'
const LINE_SOFT = '#1c2833'
const TEXT = '#e8ecef'
const MUTED = '#9fb0bc'
const GHOST = '#7d8f9c'
const COPPER = '#c8894e'
const COPPER_INK = '#e0a86b'
const GREEN = '#7ec8a0'
const BLUE = '#4a90c2'

const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif"
const SERIF = "Georgia, 'Times New Roman', serif"
const MONO = "Menlo, 'SF Mono', monospace"

// One rung of the left-hand flow.
function rung(y, { n, title, sub, hot = false }) {
  const box = hot
    ? `<rect x="64" y="${y}" width="452" height="74" rx="14" fill="rgba(200,137,78,0.13)" stroke="${COPPER}" stroke-opacity="0.55" stroke-width="1.5"/>`
    : `<rect x="64" y="${y}" width="452" height="74" rx="14" fill="${PANEL}" stroke="${LINE}"/>`
  return `
    ${box}
    <circle cx="104" cy="${y + 37}" r="17" fill="${hot ? 'rgba(200,137,78,0.22)' : '#1d2a35'}" stroke="${hot ? COPPER : LINE}"/>
    <text x="104" y="${y + 43}" font-family="${MONO}" font-size="15" font-weight="700" fill="${hot ? COPPER_INK : MUTED}" text-anchor="middle">${n}</text>
    <text x="138" y="${y + 32}" font-family="${SANS}" font-size="20" font-weight="600" fill="${TEXT}">${title}</text>
    <text x="138" y="${y + 56}" font-family="${SANS}" font-size="15" fill="${MUTED}">${sub}</text>`
}

// Downward connector between rungs.
function link(y, hot = false) {
  return `<path d="M104 ${y} L104 ${y + 20}" stroke="${hot ? COPPER : LINE}" stroke-opacity="${hot ? 0.8 : 1}" stroke-width="2"/>
    <path d="M99 ${y + 14} L104 ${y + 21} L109 ${y + 14}" fill="none" stroke="${hot ? COPPER : LINE}" stroke-opacity="${hot ? 0.8 : 1}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
}

// One row in the mini feed.
function job(y, { title, meta, selected = false, salary = null }) {
  const fill = selected ? 'rgba(200,137,78,0.12)' : '#1a242e'
  const stroke = selected ? COPPER : '#253747'
  return `
    <rect x="664" y="${y}" width="286" height="${salary ? 66 : 50}" rx="9" fill="${fill}" stroke="${stroke}" stroke-opacity="${selected ? 0.75 : 1}"/>
    <text x="678" y="${y + 21}" font-family="${SANS}" font-size="14" font-weight="600" fill="${TEXT}">${title}</text>
    <text x="678" y="${y + 39}" font-family="${SANS}" font-size="12" fill="${MUTED}">${meta}</text>
    ${salary ? `<text x="678" y="${y + 58}" font-family="${SANS}" font-size="13" font-weight="700" fill="${COPPER_INK}">${salary}</text>` : ''}`
}

// One checkpoint in the mini agent timeline.
function tick(y, { color, label, verdict = null, verdictColor = MUTED }) {
  return `
    <circle cx="978" cy="${y - 4}" r="4.5" fill="${color}"/>
    <text x="994" y="${y}" font-family="${SANS}" font-size="11.5" fill="${MUTED}">${label}</text>
    ${verdict ? `<text x="1136" y="${y}" font-family="${SANS}" font-size="11" font-weight="600" fill="${verdictColor}" text-anchor="end">${verdict}</text>` : ''}`
}

const SVG = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="16"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="${BG}"/>

  <!-- ===== header ===== -->
  <rect x="52" y="42" width="60" height="60" rx="15" fill="#16222c" stroke="#2a3a46"/>
  <polygon points="98,58 62,76 79,81" fill="${COPPER}"/>
  <polygon points="98,58 79,81 74,94" fill="#a06a38"/>

  <text x="130" y="74" font-family="${SERIF}" font-size="30" font-weight="600" fill="${TEXT}">EasyApply</text>
  <text x="130" y="99" font-family="${SANS}" font-size="17" fill="${MUTED}">An AI agent that reads your job alerts — on your own Mac.</text>

  <rect x="856" y="50" width="292" height="34" rx="17" fill="rgba(200,137,78,0.12)" stroke="${COPPER}" stroke-opacity="0.5"/>
  <circle cx="880" cy="67" r="4" fill="${COPPER}"/>
  <text x="1018" y="72" font-family="${SANS}" font-size="12.5" font-weight="700" letter-spacing="1.4" fill="${COPPER_INK}" text-anchor="middle">LOCAL LLM · 100% ON-DEVICE</text>

  <line x1="52" y1="128" x2="1148" y2="128" stroke="${LINE}"/>

  <!-- ===== left: the pipeline, four rungs ===== -->
  ${rung(162, { n: '1', title: 'Your job-alert inbox', sub: 'Gmail over IMAP — read-only, encrypted at rest' })}
  ${link(236)}
  <rect x="64" y="256" width="452" height="74" rx="16" fill="${COPPER}" opacity="0.20" filter="url(#glow)"/>
  ${rung(256, { n: '2', title: 'A local LLM reads each email', sub: 'llama.cpp · your model · fully offline', hot: true })}
  <path d="M462 272 l4.8 13.2 13.2 4.8 -13.2 4.8 -4.8 13.2 -4.8 -13.2 -13.2 -4.8 13.2 -4.8z" fill="${COPPER}"/>
  <path d="M489 300 l2.9 7.9 7.9 2.9 -7.9 2.9 -2.9 7.9 -2.9 -7.9 -7.9 -2.9 7.9 -2.9z" fill="${COPPER}" opacity="0.75"/>
  ${link(330, true)}
  ${rung(350, { n: '3', title: 'Extract, verify, deduplicate', sub: 'Merged with six official job APIs · PGlite on disk' })}
  ${link(424)}
  ${rung(444, { n: '4', title: 'One feed, newest first', sub: 'Salary up front · applications tracked to offer' })}

  <!-- ===== right: the app, in miniature ===== -->
  <rect x="648" y="162" width="500" height="356" rx="16" fill="${PANEL}" stroke="${LINE}"/>
  <rect x="648" y="162" width="500" height="42" rx="16" fill="#1c2a36"/>
  <rect x="648" y="188" width="500" height="16" fill="#1c2a36"/>
  <line x1="648" y1="204" x2="1148" y2="204" stroke="${LINE}"/>
  <circle cx="670" cy="183" r="5" fill="#ff5f57"/>
  <circle cx="686" cy="183" r="5" fill="#febc2e"/>
  <circle cx="702" cy="183" r="5" fill="#28c840"/>
  <text x="720" y="188" font-family="${SANS}" font-size="13" font-weight="600" fill="${TEXT}">Feed</text>
  <rect x="1042" y="172" width="92" height="22" rx="11" fill="rgba(200,137,78,0.14)" stroke="${COPPER}" stroke-opacity="0.45"/>
  <text x="1088" y="187" font-family="${SANS}" font-size="11" font-weight="700" fill="${COPPER_INK}" text-anchor="middle">✦ AI ON</text>

  <line x1="962" y1="204" x2="962" y2="518" stroke="${LINE}"/>

  <text x="664" y="230" font-family="${SANS}" font-size="10" font-weight="700" letter-spacing="1.6" fill="${GHOST}">FEED</text>
  ${job(240, { title: 'Senior Frontend Engineer', meta: 'Munich · Hybrid · Arbeitnow' })}
  ${job(298, { title: 'Lead Software Engineer', meta: 'Munich · On-site · found in your inbox', selected: true, salary: '€110k–€130k' })}
  ${job(372, { title: 'Staff Frontend Engineer', meta: 'Europe · Remote · Himalayas' })}
  ${job(430, { title: 'Senior Backend Engineer', meta: 'Worldwide · Remote · WeWorkRemotely' })}

  <text x="978" y="230" font-family="${SANS}" font-size="10" font-weight="700" letter-spacing="1.6" fill="${GHOST}">AGENT ACTIVITY</text>
  <rect x="978" y="242" width="156" height="46" rx="9" fill="#1a242e" stroke="#253747"/>
  <text x="990" y="262" font-family="${SANS}" font-size="10" font-weight="700" letter-spacing="1.2" fill="${GHOST}">PIPELINE</text>
  <text x="1122" y="262" font-family="${SANS}" font-size="10" fill="${MUTED}" text-anchor="end">42 / 200</text>
  <rect x="990" y="270" width="132" height="5" rx="2.5" fill="#0d141a"/>
  <rect x="990" y="270" width="50" height="5" rx="2.5" fill="${BLUE}"/>
  ${tick(312, { color: BLUE, label: 'Scanning 200 emails' })}
  ${tick(336, { color: GREEN, label: 'Backend roles', verdict: '2 jobs', verdictColor: GREEN })}
  ${tick(360, { color: '#5b6b76', label: 'Weekly newsletter', verdict: 'no jobs' })}
  ${tick(384, { color: COPPER, label: 'Prompt · 4,812 chars' })}
  ${tick(408, { color: COPPER, label: 'Thinking · 2,477 chars' })}
  <circle cx="978" cy="428" r="9" fill="none" stroke="${BLUE}" stroke-width="1.6" stroke-dasharray="30 14"/>
  ${tick(432, { color: BLUE, label: 'Analyzing "Munich roles"' })}
  ${tick(468, { color: GREEN, label: 'Munich — 12 roles', verdict: '4 jobs', verdictColor: GREEN })}
  ${tick(492, { color: '#5b6b76', label: 'Application sent', verdict: 'no jobs' })}

  <!-- ===== footer ===== -->
  <line x1="52" y1="548" x2="1148" y2="548" stroke="${LINE_SOFT}"/>
  <text x="52" y="583" font-family="${MONO}" font-size="15" fill="${MUTED}">brew install --cask souhaibbenfarhat/tap/easyapply</text>
  <text x="1148" y="583" font-family="${SANS}" font-size="15" fill="${GHOST}" text-anchor="end">Open source · MIT · macOS</text>
</svg>
`

mkdirSync(SITE_DIR, { recursive: true })
const png = new Resvg(SVG, {
  fitTo: { mode: 'width', value: W },
  font: { loadSystemFonts: true },
})
  .render()
  .asPng()
if (png.length === 0) throw new Error('resvg produced an empty PNG')
writeFileSync(OUT, png)
console.log(`Wrote ${OUT} (${statSync(OUT).size} bytes, ${W}×${H})`)
