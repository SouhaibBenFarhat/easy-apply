// Renders the app icon (PLAN.md §13.4: copper paper plane on a matte
// dark-petrol rounded square — the VZ5 badge look) to build/icon-1024.png
// via resvg, then assembles build/icon.icns with macOS sips + iconutil.
// Run: node scripts/make-icon.mjs
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Resvg } from '@resvg/resvg-js'

const BUILD_DIR = resolve(import.meta.dirname, '../build')
const PNG_1024 = join(BUILD_DIR, 'icon-1024.png')
const ICONSET = join(BUILD_DIR, 'icon.iconset')
const ICNS = join(BUILD_DIR, 'icon.icns')

// macOS Big-Sur-style squircle: the rounded square is inset ~100px on each
// side of the 1024 canvas (the OS composes the margin/shadow around it).
// Paper plane points up-right; two flat facets (no gradients) give it depth.
const SVG = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect x="100" y="100" width="824" height="824" rx="185" fill="#16222c"/>
  <rect x="100.5" y="100.5" width="823" height="823" rx="184.5" fill="none" stroke="#2a3a46" stroke-width="1"/>
  <polygon points="752,272 272,512 508,580" fill="#c8894e"/>
  <polygon points="752,272 508,580 444,752" fill="#a06a38"/>
</svg>
`

// The standard iconset members: [filename, pixel size].
const ICONSET_SIZES = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
]

function run(command, args) {
  const result = spawnSync(command, args, { stdio: ['ignore', 'ignore', 'inherit'] })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with ${result.status}`)
  }
}

mkdirSync(BUILD_DIR, { recursive: true })

const png = new Resvg(SVG, { fitTo: { mode: 'width', value: 1024 } }).render().asPng()
if (png.length === 0) throw new Error('resvg produced an empty PNG')
writeFileSync(PNG_1024, png)
if (statSync(PNG_1024).size === 0) throw new Error(`${PNG_1024} is empty`)

rmSync(ICONSET, { recursive: true, force: true })
mkdirSync(ICONSET)
for (const [name, size] of ICONSET_SIZES) {
  if (size === 1024) {
    copyFileSync(PNG_1024, join(ICONSET, name))
  } else {
    run('sips', ['-z', String(size), String(size), PNG_1024, '--out', join(ICONSET, name)])
  }
}

run('iconutil', ['-c', 'icns', ICONSET, '-o', ICNS])
if (statSync(ICNS).size === 0) throw new Error(`${ICNS} is empty`)

console.log(`Wrote ${PNG_1024} (${statSync(PNG_1024).size} bytes)`)
console.log(`Wrote ${ICNS} (${statSync(ICNS).size} bytes)`)
