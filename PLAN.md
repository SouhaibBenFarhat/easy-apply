# EasyApply — Execution Plan

> A macOS desktop app that aggregates job postings for Munich (on-site / hybrid) and remote-in-Germany/Europe roles into one fast, newest-first feed — with per-source provider plugins, salary visibility, and applied-tracking. Personal-use tool, built and shipped like GitSwitch / EasyCopy, architected and styled like CodeLobby (minus AI).

- **Status:** Plan — awaiting approval
- **Date:** 2026-07-20
- **Repo:** `SouhaibBenFarhat/easy-apply` · **Cask:** `easyapply` · **Bundle id:** `com.souhaibbenfarhat.easyapply` · **Product name:** EasyApply
- **Research basis:** all job-source claims below were live-verified with real `curl` calls on 2026-07-20 (raw captures in the session scratchpad: `ba_v6.json`, `arbeitnow.json`, `remoteok.json`, `wwr.rss` — reusable as test fixtures).

---

## 1. Product definition

**What:** One window, four pages. A **Feed** of jobs pulled from six live-verified sources (v1), normalized, deduped, sorted newest-first, filterable by work mode (Munich on-site / hybrid / remote-DE / remote-EU) and salary presence. A **detail pane** to read the posting and jump to the application page. A **Tracker** so a job is never lost or applied to twice. A **Sources** page where each provider plugin is toggled, configured, and monitored.

**Who:** You. Single user, local-only data, polite request volume.

**Non-goals (v1):** no AI features, no scraping of StepStone/Indeed/LinkedIn/Xing (see §2), no auto-apply, no Windows/Linux packaging (config exists but only mac arm64 ships), no e2e test harness (unit/integration only, like CodeLobby).

**Success criteria:** open app → fresh jobs within seconds; every feed item answers *title / company / where / mode / salary? / when / source* at a glance; one click to the real application page; applied jobs visibly leave the pipeline.

---

## 2. Data sources (live-verified 2026-07-20)

### Tier 1 — ship in v1

| Source | Access | Auth | Munich | Remote filter | Salary | Verified |
|---|---|---|---|---|---|---|
| **BA Jobsuche** (Bundesagentur für Arbeit) — *anchor* | REST v6 | static header `X-API-Key: jobboerse-jobsuche` | ✅ `wo=München&umkreis=25` | `homeoffice=nv_true` (⚠️ see notes) | ❌ (`verguetungsangabe` ≈ always `KEINE_ANGABEN`) | ✅ WORKS |
| **Adzuna** (`/jobs/de/search/{page}`) | REST | free `app_id`+`app_key` (you register once) | ✅ `where=München&distance` | keyword heuristic only | ✅ `salary_min/max` + `salary_is_predicted` — **only Munich source with salary numbers** | ✅ NEEDS_KEY (endpoint live) |
| **Arbeitnow** | REST | none | client-side (`location` contains München) + `remote` bool | `remote: true` | ❌ (field dropped from live schema) | ✅ WORKS |
| **Himalayas** (`/jobs/api/search`) | REST | none | n/a (remote board) | ✅ `country=DE` — best server-side "remote open to Germany" filter surveyed | ✅ `minSalary/maxSalary/salaryPeriod/currency` | ✅ WORKS |
| **RemoteOK** | JSON endpoint | none | n/a | `location` free-text, filter client-side | `salary_min/max` (0 = absent) | ✅ WORKS (historical 403-on-default-UA *not* reproduced live — browser UA kept defensively) |
| **WeWorkRemotely** | RSS | none | n/a | `<region>` = "Anywhere in the World" bucket | ❌ (rarely, prose only) | ✅ WORKS (same UA note as RemoteOK) |

**BA v6 empirical notes (differ from community docs — encode in code comments + tests):** search is `https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs`; details remain v4 (`/pc/v4/jobdetails/{base64url(refnr)}`). The documented `arbeitszeit=ho` returns 0 hits; `homeoffice=true` → HTTP 500; **`homeoffice=nv_true` works** (matched facet count exactly: 318/1689 Munich software jobs) and each job carries `homeofficemoeglich: boolean` for client-side use. Unofficial-but-tolerated API (powers arbeitsagentur.de itself); schema renamed wholesale between v4→v6 → **zod-validate everything, pin to observed field names**.

### Tier 2 — post-v1 (stubs designed in, not built)

| Source | Why deferred |
|---|---|
| **Remotive** | live-degraded as of July 2026: `category`/`limit` params ignored, only ~42 jobs exposed, 24 h-delayed data, strictest politeness rules (≤ 4 polls/day, > 2 req/min = blocked). Not worth a special case in v1 — the provider contract makes re-adding it a one-file PR |
| **Jooble** (meta-aggregator, surfaces StepStone/Indeed inventory) | key granted via a manual form; add when granted |
| **Landing.jobs** | live + structured salary + remote flag, but Portugal-heavy; bonus feed |
| **The Muse** | keyless 500 req/h verified, but US-centric, no salary; modest yield |
| **IMAP alert parser** (your own StepStone/LinkedIn/Indeed/Xing alert emails) | highest-value gap-filler that stays ToS-clean; needs mail credentials UX — own milestone later |

### Explicitly excluded

**StepStone / Indeed / LinkedIn / Xing direct scraping.** Researched as of July 2026 (negative claims aren't curl-provable, but nothing found contradicts them): no public search APIs (partner-only), Indeed Publisher API dead, Xing dev API shut down, aggressive anti-bot, ToS-prohibited. Their inventory reaches us indirectly via Adzuna + (later) Jooble + BA cross-postings, and via the future IMAP parser.

### Politeness & attribution (hard rules, enforced by the sync engine)

- Himalayas: 20 items/page, 429s on bursts → sequential pages, spaced, capped; link back + credit.
- RemoteOK: link back (follow link) + name the source; latest ~100 only.
- Adzuna free tier: 25/min, 250/day, 1 000/week, 2 500/month (the weekly cap is the binding constraint) — still ample; "Jobs by Adzuna" attribution.
- Remotive (when re-added, Tier 2): max ~4 polls/day, > 2 req/min = blocked; data delayed 24 h; link back + credit.
- Global: browser-like User-Agent, 2–4 syncs/day default cadence, per-provider `minInterval`, no parallel hammering.
- The detail pane always shows a **"via {Source} ↗"** link-back component → attribution satisfied by design.

### Salary reality check (shapes the UX)

Germany missed the EU Pay Transparency Directive transposition deadline (7 Jun 2026); draft bill expected early 2027, employer duties realistically ~2028. German on-site postings will stay salary-silent for now. **Therefore salary is a badge + sort + soft filter, never a hard default filter** — a hard filter would empty the Munich feed. Adzuna's predicted salaries render as "~ estimated". Structured salary comes from Himalayas (+ Landing.jobs later); RemoteOK sometimes; Remotive free-text.

---

## 3. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Shell | **Electron** (latest stable at scaffold; verify `better-sqlite3`/`electron-rebuild` compat) + **electron-vite** | Same toolchain as CodeLobby (electron-builder, not Forge) |
| UI | **React 19** + TypeScript 5.x (strict, `isolatedDeclarations`) | 3-tsconfig project-references trio copied from CodeLobby (`tsconfig.json` solution / `.node` / `.web`) |
| Styling | **Tailwind v3.4** + PostCSS + **CVA + clsx + tailwind-merge** | v3 deliberately: CodeLobby's OKLCH token generator + config integrate verbatim (see §5). Tailwind v4 migration = optional later chore, zero product impact |
| Components | **Radix primitives** in a shadcn-style `@ui-kit` | Same set as CodeLobby minus AI components |
| Data | **TanStack Query v5** (+ `persist-client`, localStorage) + **TanStack Virtual** for the feed | Query is the single source of truth for ALL state — no Redux/Zustand (house rule) |
| Routing | **TanStack Router** (code-based routes, memory history) | *Deliberate divergence from CodeLobby (which has no router): EasyApply is a multi-page data app; typed routes replace CodeLobby's slot registry — see §4 decisions* |
| Persistence | **better-sqlite3 + Drizzle** (main process) + `electron-store` (window state, settings) + `safeStorage` (API keys encrypted at rest) | CodeLobby's `--module-persistence` pattern |
| HTTP / parsing | **undici** (main process; custom UA, no CORS), **rss-parser** (WWR custom fields), **cheerio** (HTML descriptions if needed), **zod** (every provider boundary), **dompurify** (sanitize description HTML before render — XSS from external boards) | crawlee/playwright explicitly rejected: overkill for a few dozen requests/day |
| Lint/format | **Biome** (no ESLint/Prettier) + husky pre-commit (lint + typecheck + test) | Including CodeLobby's per-module layered-import enforcement |
| Tests | **Vitest** (latest) + happy-dom + React Testing Library + `@vitest/coverage-v8` | 85 % global threshold, 90 % diff-cover on changed lines (CodeLobby's CI gate) |
| Package | **pnpm ≥ 10**, Node 20, `engine-strict` | |

**Version-compat matrix (resolved at P0):** CodeLobby's configs are copied as *patterns*, not byte-for-byte — its pins are React-18-era. React 19 requires `@testing-library/react` ≥ 16; Vitest goes to the current 3.x line; Electron = the newest stable for which `better-sqlite3` prebuilds exist or `electron-rebuild` succeeds — then **pin both exact** (CodeLobby pins `better-sqlite3 9.6.0` against Electron 28; EasyApply will need a newer pair).

---

## 4. Architecture

### 4.1 Process split — one deliberate inversion vs CodeLobby

CodeLobby fetches from the **renderer** (GitHub APIs send CORS headers). Job boards don't — and RemoteOK/WWR have historically 403'd non-browser UAs (not reproduced in live testing, but the renderer couldn't set a defensive UA anyway). So in EasyApply **all fetching, normalization, dedupe, and storage live in the main process**; the renderer is a pure read/act client over typed IPC.

```
┌────────────────────────── main process ──────────────────────────┐
│  SyncScheduler ──▶ SyncEngine ──▶ Provider plugins (BA, Adzuna,  │
│  (interval + manual)             Arbeitnow, Himalayas, RemoteOK, │
│                                  WWR, …Tier-2 stubs)             │
│         raw JSON/RSS ─▶ zod validate ─▶ normalize ─▶ classify    │
│                       ─▶ dedupe ─▶ upsert SQLite (Drizzle)       │
│  IPC: jobs:* sources:* sync:* settings:* db:*                    │
│  events: sync:progress, sync:completed                           │
└──────────────────────────────────────────────────────────────────┘
                       ▲ typed preload bridge (window.electron)
┌────────────────────── renderer ──────────────────────────────────┐
│  TanStack Query (@data: queries/mutations/keys over IPC)         │
│  TanStack Router pages: Feed · Tracker · Sources · Settings      │
│  @ui-kit components · theming · virtualized lists                │
└──────────────────────────────────────────────────────────────────┘
```

IPC conventions copied from CodeLobby: kebab-case `ipcMain.handle` channels, responses `{ success: boolean; data?: T; error?: string }`, push events via `webContents.send` with preload `on*` subscriptions returning unsubscribe closures, hand-typed `ElectronAPI` in `src/preload/electron-api.d.ts`. `contextIsolation: true`, `nodeIntegration: false`; external links only via `shell.openExternal`.

### 4.2 Directory layout & enforced layers

CodeLobby's module isolation, with two renames: modules live under `modules/` (not `--module-*` — leading dashes fight CLI tools) and the slot system is **dropped** (decision below).

```
easy-apply/
├─ src/main/            window, menu, store, sync engine + scheduler, IPC registration
├─ src/preload/         index.ts + electron-api.d.ts (typed bridge)
├─ src/renderer/        index.html, main.tsx, styles/ (globals.css, theme.config.mjs)
├─ modules/
│  ├─ logger/           L0 — shared logging (main + renderer variants)
│  ├─ ui-kit/           L1 — components, one folder each, + hooks (useDeferredLoading)
│  ├─ data/             L1 — query client, keys, queries/, mutations/ (renderer)
│  ├─ sources/          shared/ (Job schema, provider types) + main/ (provider impls)
│  ├─ persistence/      main/ (Drizzle schema, connection, repositories, db:* IPC)
│  ├─ test-utils/       L2 — setup, customRender, electron mock, fixtures/
│  ├─ feed/  tracker/  sources-page/  settings/  shell/    L3 — feature modules
│  └─ app/              L4 — router, App, bootstrap
├─ scripts/             generate-theme.mjs, make-icon, build helpers
├─ site/                landing page (single self-contained index.html + icon)
├─ docs/                ARCHITECTURE.md, THEMING.md, RELEASING.md, SOURCES.md
└─ .claude/skills/      repo skills (§9)
```

Path aliases (`@ui-kit`, `@data`, `@sources`, `@feed`, …) kept in sync across `electron.vite.config.ts`, `tsconfig.*.json`, `vitest.config.ts` — and **layer rules enforced by Biome `noRestrictedImports` overrides** exactly like CodeLobby: L0 logger → L1 ui-kit/data (can't import each other) → L2 test-utils → L3 features (can't import each other) → L4 app. `sources` and `persistence` slot in as L1 alongside `data` (their `main/` halves may additionally import `@logger` only). Feature modules never touch `setQueryData`; all writes via `@data` mutations.

**tsconfig split for the new module shapes:** `modules/*/main/**` compiles under `tsconfig.node.json` only; `modules/*/shared/**` under both (types + zod schemas usable from either process); everything else under `tsconfig.web.json` (which carries `isolatedDeclarations`). This rule is written into the Biome overrides and CLAUDE.md so no file ends up in the wrong compilation unit.

**Decision — slot system dropped:** CodeLobby's slot registry exists so canvas-style feature panels self-register with zero cross-imports. EasyApply is four routed pages; TanStack Router's typed route tree gives the same decoupling with less indirection (only `modules/app` imports feature modules — allowed L4→L3). The layered-import guarantee survives; the mechanism changes. Toasts/modals mount once in the shell.

### 4.3 Provider plugin contract (the heart of the app)

```ts
// modules/sources/shared/types.ts
export type SourceId = 'ba' | 'adzuna' | 'arbeitnow' | 'himalayas'
  | 'remotive' | 'remoteok' | 'wwr' | 'jooble' | 'landingjobs' | 'themuse'

export interface ProviderMeta {
  id: SourceId
  displayName: string
  homepage: string
  enabledByDefault: boolean          // keyless sources: true
  requiresKey?: { fields: ReadonlyArray<{ id: string; label: string; hint: string }> }
  attribution: { label: string; required: boolean }   // "via RemoteOK ↗"
  politeness: { minIntervalMinutes: number; maxRequestsPerSync: number }
}

export interface FetchContext {
  http: PoliteHttpClient                // undici wrapper: UA, timeout, retry, per-provider throttle
  config: Record<string, string>       // decrypted keys (safeStorage)
  searchProfile: SearchProfile         // { city: 'München', radiusKm: 25, keywords, remoteScopes }
  logger: Logger
}

export interface JobSourceProvider {
  meta: ProviderMeta
  fetch(ctx: FetchContext): Promise<RawPayload[]>      // raw pages/feeds, NO parsing decisions
  parse(raw: RawPayload): NormalizedJob[]              // zod at the boundary; throws → sync_run error, never crashes app
}
```

Each provider = one file + one zod schema + one fixture test (fixtures = the actual captured live responses). Adding a source touches exactly: `modules/sources/main/<id>.ts`, `schemas.ts`, registry array, fixture, test — documented as a repo skill (§9).

`PoliteHttpClient` (undici wrapper: UA, timeout, retry/backoff, per-provider throttle) is built and fake-timer-tested in PR 5, before any provider needs it. `SearchProfile` defaults ship with the `settings:get/set` IPC in PR 3 so PRs 6–9 code against real values before the Settings UI exists (PR 11): `{ city: 'München', radiusKm: 25, keywords: ['software'], remoteScopes: ['germany','europe','worldwide'] }` — BA/Adzuna searches are keyword-driven and need `keywords` from day one.

### 4.4 Canonical job model & dedupe

```ts
export interface NormalizedJob {
  id: string                     // `${sourceId}:${sourceJobId}`
  sourceId: SourceId
  url: string                    // posting page (attribution link)
  applyUrl: string | null
  title: string
  company: string
  location: { raw: string; city: string | null; country: string | null }
  workMode: 'onsite' | 'hybrid' | 'remote' | 'unknown'
  remoteScope: 'germany' | 'europe' | 'worldwide' | null
  salary: { min: number | null; max: number | null; currency: string | null
            period: 'year' | 'month' | 'hour' | null; isEstimated: boolean; raw: string | null }
  postedAt: string | null        // ISO; fetchedAt fallback for sorting
  descriptionHtml: string | null // sanitized with dompurify before render
  tags: string[]
  dedupeKey: string              // normalize(company) + '|' + normalize(title) + '|' + (city ?? scope)
}
```

- **Upsert key** `(id)` — re-syncs update, never duplicate.
- **Cross-source dedupe** by `dedupeKey` (lowercase, strip legal suffixes GmbH/SE/AG, collapse whitespace/punct, strip `(m/w/d)` variants). Grouped **at query time**: feed shows one canonical row (prefer: has salary → earliest postedAt) with source chips for the duplicates. Conservative on purpose — a false merge hides a job; a missed merge only shows two rows.
- **Work-mode classification** per source: BA → `homeofficemoeglich ? 'hybrid' : 'onsite'`; remote boards → `'remote'` + scope mapped from `candidate_required_location` / `locationRestrictions` / `<region>` (DE→germany, Europe|EMEA→europe, Worldwide|Anywhere→worldwide); Arbeitnow → `remote` bool; Adzuna → regex heuristic on title/description (`remote|home\s?office|hybrid`) else `'unknown'`. Pure functions in `classify.ts` with table-driven tests.

### 4.5 SQLite schema (Drizzle)

- `jobs` — all NormalizedJob columns + `firstSeenAt`, `status` (`null | interested | applied | interview | rejected`), `statusUpdatedAt`, `notes`, `hidden`
- `sync_runs` — source, startedAt, finishedAt, ok, error, inserted, updated
- `provider_state` — source (pk), enabled, lastSyncAt, configJson (keys via safeStorage, never plaintext)
- **Paths (dev vs packaged — the classic Electron trap):** DB at `app.getPath('userData')/easyapply.db`; Drizzle migrations resolved as `app.isPackaged ? path.join(process.resourcesPath, 'drizzle') : <repo>/drizzle`, shipped via electron-builder `extraResources` (CodeLobby's exact pattern — omit it and the packaged dmg crashes on first launch while `pnpm dev` works fine).
- Retention pruning + JSON export: **deferred post-v1** — a personal DB stays small for a long time; v1 keeps only Settings → Clear DB.

### 4.6 Sync engine

- Scheduler: default every **3 h while app is open** + "Sync now" (global and per-source). Per-provider `minInterval` respected even on manual sync (e.g. Himalayas pages stay spaced and capped).
- Providers run **sequentially** (politeness), each isolated: one provider failing → its `sync_run` records the error, feed still updates from the rest, Sources page shows the red state.
- Completion pushes `sync:completed {inserted, updated, perSource}` → renderer invalidates `keys.jobs.*` → feed refreshes; toast summarizes ("14 new jobs · 3 sources").
- "New" divider: jobs with `firstSeenAt > lastFeedVisitAt` — a `local`-namespace persisted query + mutation (added in PR 10), written on feed blur/visit (PR 12).

### 4.7 Renderer data layer (CodeLobby conventions verbatim)

- `modules/data/client.ts` — QueryClient; localStorage persistence **only** for `settings`/`local` namespaces; job data always read fresh from SQLite (it *is* the cache).
- `modules/data/keys.ts` — single typed `keys` object, hierarchical: `keys.jobs.feed(filters)`, `keys.jobs.detail(id)`, `keys.jobs.counts`, `keys.sources.list`, `keys.sync.status`, `keys.system.theme`.
- Queries/mutations as named hooks with explicit return types (`isolatedDeclarations`): `useFeed(filters)`, `useJob(id)`, `useSources()`, `useSyncStatus()`; `useSetJobStatus()` (optimistic), `useSyncNow()`, `useUpdateProvider()`, `useSetTheme()`.

### 4.8 Anti-flash loading — the generic rule

One hook, used everywhere, tested with fake timers:

```ts
// modules/ui-kit/hooks/use-deferred-loading.ts
// Never flash: skeleton appears only if loading > showDelay,
// and once shown stays >= minVisible. Returns what to render *now*.
export function useDeferredLoading(
  isLoading: boolean,
  opts: { showDelay?: number; minVisible?: number } = {},
): 'content' | 'skeleton' | 'blank'   // defaults: showDelay 150 ms, minVisible 400 ms
```

Paired with CodeLobby's patterns: **layout-matching skeletons** (JobDetailSkeleton mirrors JobDetail exactly — zero shift), `Skeleton` with the slow 2.5 s opacity pulse (not `animate-pulse`), and aggregate loading semantics (feed reports loading only when *no* source has data yet — a slow provider never blanks an already-populated feed).

### 4.9 Security hardening (concrete, not hand-wavy)

- **Navigation guards (PR 3):** `webContents.setWindowOpenHandler(() => ({ action: 'deny' }))` + `will-navigate` → `preventDefault`; any http/https URL originating from app UI is routed through `shell.openExternal` with a scheme whitelist. Without this, a link inside sanitized job HTML could navigate the whole window to an arbitrary page.
- **CSP:** production meta CSP in `index.html`: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'` — tight `connect-src` is free because *all* network I/O lives in main. Relaxed dev variant for Vite HMR.
- **Description HTML policy:** DOMPurify **allowlist** — formatting tags only (`p, br, ul, ol, li, strong, em, b, i, h1–h4, code, pre, blockquote, a`); `img/picture/iframe/svg/style/script` stripped → descriptions render text-only, consistent with the no-remote-content stance. Anchor clicks are intercepted in the detail pane and forwarded to `shell.openExternal` (belt) — the main-process guards catch anything that slips (suspenders).
- **safeStorage (PR 8):** all calls gated behind app `ready`; `safeStorage.encryptString()` output stored base64 in `provider_state.configJson`; if `isEncryptionAvailable()` is false → refuse to save the key and surface the error on the Sources card.

---

## 5. Design system — "quiet Apple tool, VZ5 palette"

CodeLobby's token architecture is the engineering reference. The **taste reference is the Cupra Formentor VZ5**: matte dark petrol blue as the dominant material, copper as the single warm accent, black/dark-grey doing the supporting work. **Dark mode is the flagship and the default theme**; light mode remains fully supported (original requirement) as a petrol-tinted derivation of the same system. Still no decorative gradients — the glass treatment in §5.3 is an Apple *material* (blur + translucency + one hairline highlight), not gradient slop.

### 5.1 Tokens — the VZ5 palette in OKLCH (pipeline copied verbatim from CodeLobby)

`theme.config.mjs` (roles + per-token `{role, l, c}` OKLCH) → `pnpm generate:theme` validates (contrast ≥ 4.5:1, elevation ordering) and writes raw `L C H` triplets between `GENERATED` markers in `globals.css` → Tailwind consumes as `oklch(var(--token) / <alpha-value>)`. Full semantic vocabulary: surfaces `background / surface-content / surface / surface-raised / header / surface-hover / overlay`; text 4 levels (`foreground`, `-muted`, `-subtle`, `-ghost`); borders 3 levels; `interactive-hover/-active`; status quads `success / warning / destructive / info` each with `-foreground/-subtle/-border`. localStorage key: `easyapply-theme`.

**Roles (starting values — the generator's ≥ 4.5:1 contrast gate is the referee, tuned at PR 1):**

- **`neutral` = petrol, hue ≈ 215.** Dark surfaces carry real chroma (c 0.020–0.035) so they read as *petrol blue*, not tinted grey — the Petrol-Blue-Matt move. Light surfaces keep a whisper of it (c 0.006–0.012).
- **`primary` = copper, hue ≈ 60.** Dark mode ≈ `l 0.68 c 0.13`, light mode ≈ `l 0.55 c 0.12` (per-mode pair — copper must glow on dark petrol and hold contrast on light paper).
- **Status hues spaced away from copper** so it stays unmistakable: warning ≈ 95 (clearly yellow, never copper-adjacent), success 155, destructive 27, info ≈ 230 (a cyan-blue distinct from the surface petrol).
- **Copper is scarce by design** — the wheel-accent principle. It appears on: selected job row, primary button, active nav item, focus ring, and the **salary badge** (the one warm data point in the feed). Everything else is petrol/neutral. If copper is everywhere, it's nowhere.

Key dark-mode tokens (approx):

| Token | OKLCH (≈) | Reads as |
|---|---|---|
| `background` | `0.145 0.030 215` | near-black petrol |
| `surface` | `0.185 0.032 215` | dark petrol panel |
| `surface-raised` | `0.202 0.034 215` | lifted petrol |
| `header` | `0.310 0.036 215` | petrol chrome (glass sits on this) |
| `primary` | `0.68 0.13 60` | copper |
| `foreground` | `0.960 0.005 215` | near-white, faint cool cast |

### 5.2 Elevation — your stated rule, encoded

Exactly the CodeLobby ladder (which matches your spec: elevated chrome is **darker** in light mode, and the opposite in dark):

| Surface | Light L | Dark L |
|---|---|---|
| `background` (content canvas) | **1.000** — lightest | **0.145** — darkest |
| `surface-content` | 0.978 | 0.160 |
| `surface` (panels, sidebar) | 0.958 | 0.185 |
| `surface-raised` | 0.944 | 0.202 |
| `header` (app chrome) | **0.850** — darkest chrome | **0.310** — lightest |
| `overlay` (popovers) | back to 1.000 | 0.275 |

Borders do the separation work in light mode; theme-varied `--shadow-elevation-low/medium/high` triple in strength in dark. The ladder's **L values are unchanged from CodeLobby** — only hue/chroma move to petrol — so the validated contrast and elevation ordering carry over; in dark mode chroma rises slightly with elevation (deepest layers blackest, raised layers bluest), which is what makes the chrome read as *material* rather than tinted grey. **No random card nesting:** structural rule documented in the theming skill — a surface may only sit on the level directly beneath it; content areas are flat; cards are reserved for the detail pane and Sources page, never nested.

### 5.3 Glass — the Apple material layer

One `.glass` recipe (CodeLobby's `.header-bar` generalized): `background: oklch(var(--header) / 0.66)` + `backdrop-filter: saturate(180%) blur(24px)` + a 1px inset top highlight (`white/0.06`) + hairline `border-b border-border-subtle`. Solid fallback via `@supports not (backdrop-filter: blur(1px))` and under macOS reduced-transparency → plain `--header`.

**Glass only where content scrolls underneath it** — that's what makes the material legible instead of decorative:

1. The **window header bar** (traffic-light zone) — feed scrolls under it.
2. The **sticky filter bar** above the virtualized feed.
3. The **detail-pane header** (title · company · actions) — the description scrolls beneath.
4. **Overlays**: popovers/dialogs at `overlay/0.85` + `blur(20px)`; the dialog scrim additionally blurs the page behind it (`blur(8px)`); toasts share the recipe.

**Never glass:** feed rows, cards, sidebar at rest, any large static area — blur everywhere reads as mud and costs GPU. Hard budget: **≤ 3 simultaneous `backdrop-filter` layers** on screen; documented in the theming skill.

### 5.4 Type & component idioms

- **Apple system stack** (SF Pro), `-0.01em` body tracking, 600-weight `-0.02em` headings, dense 13–14 px working sizes. *No Inter/Fraunces in the app* — the system stack is what makes it feel native (fonts stay on the website).
- The site's **micro-caps label idiom** (`text-[0.7rem] uppercase tracking-[0.18em] text-foreground-muted`) for job metadata: company · location · posted · source.
- Motion tokens: 150/200/350 ms, `cubic-bezier(0.25,0.1,0.25,1)`, `active:scale-[0.97]`, 3 px `primary/0.4` focus ring, `prefers-reduced-motion` honored.
- Radius scale 4/6/8/10/12 px; controls `h-9`; segmented-control Tabs; pill badges using `-subtle` bg + `-border` + colored text (quiet at density).
- **Feed rows are flat ListMenu-style rows** (`px-3 py-2`, hairline `border-b border-border-subtle`, `hover:bg-interactive-hover`) — *not* floating cards; no translateY inside scrolling lists. Selected row = CodeLobby's treatment: `primary/0.12` fill + primary border + soft `primary/0.15` ring.
- Status → color mapping: applied = success · interview = info · pending/interested = warning · rejected = destructive.

### 5.5 Motion choreography

Tokens stay as in §5.4 (150/200/350 ms, `cubic-bezier(0.25,0.1,0.25,1)`). What animates, and when:

- **Entrances:** first feed paint = staggered fade + 4px rise on the first ~10 visible rows (30 ms steps) — **once per app launch**, never on refresh, filter change, or scroll.
- **Selection:** the detail pane **crossfades** on job change (outgoing 100 ms fade-out, incoming 150 ms fade-in; no slide, no layout shift). The `useDeferredLoading` skeleton participates in the same crossfade — skeleton→content is a 200 ms opacity swap, which is the anti-flash rule made visible.
- **Overlays:** dialogs `scale(0.96)→1` + fade, 200 ms in / 150 ms out; popovers/tooltips fade + 2px shift at 150 ms; toasts slide-in-from-bottom + fade, auto-dismiss with a 350 ms fade-out.
- **State changes:** the "new jobs" divider fades in; the sync icon rotates while syncing (the only looping animation, and only while genuinely active); status-badge changes crossfade color at 150 ms; removals (hiding a job) collapse height 200 ms + fade.
- **Inside scrolling lists: background-color transitions only** — no transforms, no shadows on hover, nothing animating during scroll or virtualizer recycling.
- **`prefers-reduced-motion`:** entrances and scale effects off, swaps become instant; only essential-feedback opacity remains.
- Rule of thumb, documented in the theming skill: *motion communicates a state change; nothing loops idle, nothing bounces, nothing moves that the user didn't cause.*

---

## 6. UX spec

### Pages

1. **Feed** (default) — master-detail split.
   - Left: filter bar (work-mode segmented control: All · Munich on-site · Hybrid · Remote DE · Remote EU/anywhere; keyword search; "has salary" toggle; source multi-select) above a **virtualized** newest-first list. "New since last visit" divider. Each row: title (semibold sm) · company + location micro-caps · mode badge · salary badge (or "~ est." / absent) · relative time · source chip(s).
   - Right: detail pane — sanitized description, meta grid, **"via {Source} ↗"** attribution link, primary button **Open application page** (`shell.openExternal`), status buttons (Interested / Applied / …), notes field. Selection in the router search param (`?job=…`); memory history has no browser chrome, so ⌘[ / ⌘] and mouse back/forward buttons are explicitly wired to `router.history.back()/forward()`.
2. **Tracker** — the same jobs grouped by status (Interested → Applied → Interview → Rejected), each group a flat list with status-quad badges; empty states with a one-line nudge. This page is why the app makes you *apply faster*, not just browse faster.
3. **Sources** — one card per provider: toggle, last sync + result, jobs contributed, key entry for Adzuna (masked, safeStorage), politeness note, error state with retry.
4. **Settings** — theme (light/dark/system, live system-follow; **default dark** — the VZ5 look is the app's identity), search profile (city, radius, keywords, remote scopes), sync interval, danger zone (clear DB). *(Retention tuning + JSON export: post-v1.)*

### States & behaviors

- **First run:** keyless sources pre-enabled → immediate first sync with progress; dismissible banner suggests the free 2-minute Adzuna signup ("the only source with Munich salary data").
- Loading: `useDeferredLoading` + layout-matching skeletons everywhere; feed never blanks once populated.
- Errors: per-source, non-blocking, surfaced in Sources + a quiet toast; the feed always renders whatever is available.
- Empty: distinct empty states for "no jobs yet" (first sync running) vs "filters exclude everything" (offer reset).
- Keyboard: ↑/↓ row navigation, Enter opens detail, ⌘R sync now, ⌘1–4 pages, ⌘F focus search.
- Window: 1400×900 min 1000×700, `hiddenInset` traffic lights, background matches `--background` per theme (no white flash on launch).

---

## 7. Testing

- **Providers:** fixture-driven — each provider parses its captured live response. The captures are **already preserved in this repo** at `planning/fixtures/` (`ba_v6.json`, `ba_ho.json`, `arbeitnow.json`, `remoteok.json`, `wwr.rss`, `muse.json`, `landingjobs.json`) and move to `modules/test-utils/fixtures/` at P0; a documented re-capture `curl` per source goes into `docs/SOURCES.md` (needed for Himalayas and Adzuna, which have no capture yet). zod schema drift = failing test, not runtime crash. Politeness logic unit-tested (fake timers).
- **Pure cores:** normalize / classify / dedupe — table-driven tests incl. the nasty real cases found in research (RemoteOK's `location: "Good Night, "`, `(m/w/d)` title variants, GmbH suffixes).
- **Hooks:** `useDeferredLoading` timing matrix (fast-resolve → never shows; slow → shows ≥ minVisible).
- **UI:** every ui-kit component co-located `.test.tsx` (CodeLobby convention: one folder per component, `index.ts` barrel, test beside source); feature components tested through `@test-utils` customRender (QueryClient + Router + Tooltip providers, seeded electron mock incl. `window.electron.jobs/sources/sync`). `@test-utils` is scaffolded **at P0** (setup, customRender, electron-mock skeleton — grown in PRs 3/9/10) so PR 1's first tests aren't blocked; Vitest runs with `passWithNoTests: true` until PR 1 lands, then it's removed.
- **Main process:** repository + IPC-handler units against in-memory SQLite.
- **Gates:** 85 % global coverage threshold; CI enforces **90 % diff-cover on changed lines**; husky pre-commit runs lint + typecheck + test.

---

## 8. Repo, CI, release, distribution

### CI (adapted from CodeLobby's workflows)

- **`test.yml`** — paths-filter → `lint-typecheck` (Biome + the 3-tsconfig typecheck incl. `--emitDeclarationOnly` web pass) → `build` (`pnpm build`, i.e. electron-vite production build — your "typechecks **and build** in CI" requirement; packaging into a dmg stays release-only) → `unit` (Vitest with coverage, PR comment, diff-cover ≥ 90 % — **unsharded to start**; CodeLobby's 3-way sharding gets reintroduced when suite time warrants, a repo starting at zero tests doesn't need shard ceremony) → aggregate **`test`** gate job (always-runs; the required check).
- **`pr-title-lint.yml`** — Conventional-Commit PR titles (squash-merge uses the title).
- **`release-drafter.yml`** — rolling draft, autolabeler, semver from labels (`v$RESOLVED_VERSION`).
- **`release.yml`** — on release published: `pnpm build` → `electron-builder --mac --arm64 --publish always -c.extraMetadata.version=${TAG#v}` (unsigned: `CSC_IDENTITY_AUTO_DISCOVERY: false`) → **tap-bump step** from easy-copy's pipeline: guarded by `if: env.TAP_TOKEN != ''`, seds `version`/`sha256` in `Casks/easyapply.rb` (two-space indent is load-bearing for the sed), commits as `github-actions[bot]` "easyapply X.Y.Z", pushes to tap **master**.
- **`pages.yml`** — deploys `site/` on main pushes touching `site/**`.

### Repo settings (applied via `gh api` during Phase 0 — the gaps easy-copy had are closed from day one)

- Branch protection on `main`: required checks **`test`** + **`Validate PR title`**; force-pushes/deletions off.
- **`allow_auto_merge: true`** (your requirement) + `delete_branch_on_merge: true`; squash-merge default. Ritual: open PR → `gh pr merge --squash --auto` → lands only on green CI.
- Secrets **before first release**: `TAP_GITHUB_TOKEN` (PAT with push to homebrew-tap — the exact secret easy-copy was missing at v0.1.0); optional `RELEASE_PAT` for user-owned drafts.

### Homebrew + website + README

- **Cask** `homebrew-tap/Casks/easyapply.rb` — added **manually once** (CI only bumps version/sha256): merges `codelobby.rb`'s dmg pattern (`EasyApply-arm64.dmg` URL template, `livecheck :github_latest`, `depends_on arch: :arm64`) with the gitswitch/easycopy template's postflight `xattr -dr com.apple.quarantine` (unsigned build) + `uninstall quit:` bundle id + `zap trash:`; + README table row. Install: `brew install --cask souhaibbenfarhat/tap/easyapply`.
- **Website** `site/index.html` — the GitSwitch/EasyCopy single-file template: Fraunces/Inter, **VZ5 palette** (dark-petrol hero, copper accents; light/dark via `prefers-color-scheme`), click-to-copy brew command, **pure HTML/CSS mockup of the feed window** as the "screenshot" — rendered in the dark petrol theme with a copper-selected row, Why-it-exists cards, honest-plumbing steps + specs `<dl>`, install band with the `xattr` note, footer. Deployed to `souhaibbenfarhat.github.io/easy-apply/`.
- **README** — the house skeleton exactly: centered icon + `<h1>` + tagline + product-page link → motivation paragraph → `## Features` (bolded-phrase bullets) → `## Install` (brew block, "macOS 14+ · Apple Silicon") → `## How it works` (honest plumbing + privacy: *everything stays on your machine; API keys encrypted locally; polite polling with per-source attribution*) → `## Build from source` (pnpm) → `## License` MIT. No badges, no screenshots (visuals live on the site).

---

## 9. Docs & repo skills

- `docs/ARCHITECTURE.md` (process split, layers, IPC), `docs/THEMING.md` (tokens, elevation ladder, generator), `docs/SOURCES.md` (per-provider quirks — the BA `homeoffice=nv_true` story lives here), `docs/RELEASING.md` (ritual + future code-signing steps).
- **`CLAUDE.md`** at root — trimmed CodeLobby guidelines: TanStack Query is the single source of truth; never raw HTML when `@ui-kit` has it; mutations-only writes; one component per folder + barrel + co-located test; **components are `.tsx` files only, one component per file, kept small — split at roughly 150 lines or one responsibility, extracting sub-components and hooks instead of growing files** (your "no large components" rule, stated as law); `isolatedDeclarations` explicit return types; `type="button"`; layer rules; Apple design grammar.
- **`.claude/skills/`** — the conventions as invocable skills:
  - `ui-kit` — how to add/extend components (Radix + CVA + tokens, never raw Tailwind colors; `.tsx` only, small components, one per folder)
  - `theming` — semantic tokens only, elevation/nesting rules, run `generate:theme`, contrast gates, the glass-material rules (where `.glass` may/may not apply, ≤ 3 blur layers) and the motion choreography rules (§5.3/§5.5)
  - `data-layer` — keys/queries/mutations conventions, IPC contract, invalidation patterns
  - `add-job-source` — the provider checklist (file + schema + fixture + registry + test + Sources card)
  - `testing` — test-utils, fixtures, coverage gates
  - `release` — cut a release, verify tap bump, bump site specs version

---

## 10. Execution plan — phased PRs

Phase 0 is pushed directly to `main` (pre-protection); everything after lands as Conventional-Commit PRs with auto-merge on green CI. Order: **ui-kit first** (your sequence), then the data foundation, then a *minimal* routed shell (pages need a router to mount into — that's why the shell scaffold precedes them), then the **pages**, then final composition/polish. This is your "ui-kit → pages → compose" honored with the one technical insertion made explicit.

| # | PR | Contents |
|---|---|---|
| **P0** | `chore: scaffold` *(direct push)* | electron-vite skeleton, tsconfig trio (+ the `main/`/`shared/` compile-unit rules), Biome (+ layer rules), husky, Vitest (`passWithNoTests` until PR 1), **`@test-utils` skeleton** (setup, customRender, electron-mock stub), **fixtures committed** from `planning/fixtures/` → `modules/test-utils/fixtures/`, Tailwind + theme-generator pipeline with a neutral placeholder `theme.config` + marker-bearing `globals.css` (so `pnpm build` passes; PR 1 swaps in the real tokens), CI workflows, LICENSE, README stub. Then: `gh repo create`, branch protection (required: `test`, `Validate PR title`), **auto-merge on**, delete-branch-on-merge, secrets (`TAP_GITHUB_TOKEN`). Version-compat matrix resolved and pinned here (§3). |
| 1 | `feat(ui-kit): tokens + core primitives` | real theme.config (**VZ5 palette**: petrol neutrals hue 215 + copper primary hue 60), generated globals.css incl. the `.glass` recipe + motion keyframes (§5.3/§5.5), Button/Input/Label/Badge/Skeleton/Separator/ScrollArea/Tooltip + tests (remove `passWithNoTests`) |
| 2 | `feat(ui-kit): overlay + composite primitives` | Dialog/Popover/Select/Tabs/Toast/Switch/Textarea/Card/Sheet/ListMenu/ViewHeader/EmptyState + `useDeferredLoading` + tests |
| 3 | `feat(main): app foundation` | window/menu/store/logger, typed preload bridge, theme-aware background, **navigation guards + production CSP (§4.9)**, **`settings:get/set` IPC with SearchProfile defaults (§4.3)** |
| 4 | `feat(model): job model + persistence` | **`modules/sources/shared/`: NormalizedJob types + zod schemas** (so the DB schema has something to encode — ordering fix), Drizzle schema, migrations, repositories, `db:*` IPC, **userData DB path + packaged migrations resolution (§4.5)**, in-memory tests |
| 5 | `feat(sources): contract + pure cores` | provider contract, **`PoliteHttpClient`** (+ fake-timer politeness tests), normalize/classify/dedupe + fixture-driven table tests |
| 6 | `feat(sources): BA + Arbeitnow` | anchor providers incl. the v6 quirks (`homeoffice=nv_true`), fixture tests |
| 7 | `feat(sources): remote boards` | Himalayas, RemoteOK, WWR (rss-parser customFields); Tier-2 stubs registered disabled |
| 8 | `feat(sources): adzuna` | key config contract, safeStorage per §4.9, salary mapping incl. `salary_is_predicted` |
| 9 | `feat(sync): engine + scheduler` | sequential runs, politeness, sync_runs, IPC + push events, electron-mock surface grown |
| 10 | `feat(data): renderer data layer` | client, keys, queries, mutations, persistence whitelist, `lastFeedVisitAt` local query/mutation |
| 11 | `feat(app): routed shell + settings` | TanStack Router (+ ⌘[/⌘] & mouse-button history wiring), sidebar nav, header (theme toggle, sync button), Settings page |
| 12 | `feat(feed): feed + detail` *(the flagship page)* | virtualized list, filter bar, detail pane + JobDetailSkeleton, new-divider write, dompurify allowlist + anchor interception (§4.9) |
| 13 | `feat(tracker): status tracking` | status mutations (optimistic), Tracker page, notes |
| 14 | `feat(sources-page): provider management` | cards, toggles, key entry, error/retry states |
| 15 | `chore(release): packaging` | icon (**copper glyph on matte dark petrol** → icns), electron-builder config **incl. `extraResources` for drizzle/**, release.yml (+ tap-bump step) + drafter wired, RELEASING.md |
| 16 | `docs: readme + skills` | full README, docs/ (incl. SOURCES.md re-capture commands), CLAUDE.md, .claude/skills |
| 17 | `feat(site): landing page` | site/index.html + pages.yml live |
| **R** | **Release v0.1.0** | publish draft → CI attaches dmg → **install the packaged dmg and verify first-run: DB created in userData, migrations apply, first sync populates the feed** → add `easyapply.rb` + tap README row (manual, first time) → verify bot tap-bump path → `brew install --cask souhaibbenfarhat/tap/easyapply` on this machine → site + specs check |

Post-v1 backlog: Remotive re-enable (one-file PR when its API recovers), Jooble (when key granted), Landing.jobs, The Muse, IMAP alert parser, retention pruning + JSON export, auto-update (needs real code-signing first), **Tailwind v4 migration (scheduled: after v0.1.0 ships)**, CI test-sharding when suite time warrants, e2e smoke via Playwright-for-Electron.

---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| BA API is unofficial and has renamed schemas before | zod at the boundary; provider failure isolated to its sync_run; fixtures pin observed field names; quirks documented in SOURCES.md |
| Remotive live behavior already drifted (params ignored, ~42 jobs) | treat as minor source; client-side filtering; low expectations encoded in tests |
| Munich feed looks empty with "has salary" on | salary is a badge/sort/soft-filter, never default-on; Adzuna banner explains where salary data exists |
| Cross-source dedupe merges two different jobs | conservative key, group-don't-delete, source chips always visible |
| XSS / hostile HTML from job boards | full §4.9 stack: DOMPurify allowlist (text-only descriptions), production CSP, window-open deny + will-navigate guards, anchor interception |
| `better-sqlite3` native build vs Electron version | CodeLobby's known-good postinstall (`electron-rebuild` + `install-app-deps`); pin versions at scaffold after a compat check |
| Unsigned app = Gatekeeper friction | cask postflight strips quarantine (house pattern); manual-zip `xattr` note on site + release notes; signing documented as future step |
| Silent tap-bump failure on first release | `TAP_GITHUB_TOKEN` added in Phase 0, verified in the v0.1.0 checklist (the easy-copy lesson) |

---

## 12. Decisions I've made (flag if you disagree)

1. **Tailwind v3.4, not v4** — copies CodeLobby's proven OKLCH generator + config verbatim; v4 is a later cosmetic-free chore.
2. **TanStack Router replaces the slot system** — real typed pages for a multi-page data app; layer isolation preserved via Biome.
3. **All fetching in the main process** — CORS + User-Agent realities of job boards (CodeLobby fetches in renderer because GitHub allows it).
4. **VZ5 palette** (your call, resolved): dark-petrol-dominant surfaces + copper as the single accent + black/dark-grey support; dark mode is the default and flagship, light mode a petrol-tinted derivation; glass chrome and motion choreography per §5.3/§5.5.
5. **`modules/` directory naming** instead of `--module-*` prefix — same aliases, same isolation, friendlier tooling.
6. **Salary = soft filter** — hard-filtering would empty the Munich feed until German pay-transparency law lands (~2027/28).
7. **dmg artifact** (like codelobby cask), not zip — natural electron-builder output, existing cask pattern in your tap.
8. **Remotive deferred to Tier 2** — its API is live-degraded (params ignored, ~42 jobs, strictest rate rules); not worth a v1 special case when re-adding is a one-file PR.
9. **v1 scope cuts for simplicity:** retention pruning + JSON export deferred; CI starts unsharded. All in the named backlog, none architectural.

## 13. Needs from you

1. **Approve this plan** (or mark up §12).
2. **Adzuna signup** (~2 min, free, developer.adzuna.com) whenever convenient — app works without it; it's the only Munich salary source. *(Do the signup yourself — I'll wire the key entry UI.)*
3. **`TAP_GITHUB_TOKEN`** — a PAT with push access to homebrew-tap, added as an easy-apply repo secret before v0.1.0 (I'll remind you at Phase 15).
4. **Icon motif** preference (paper-plane / checkmark-on-briefcase / "EA" glyph — **copper on a matte dark-petrol rounded square**, the VZ5 badge look) — or I'll draft options at Phase 15.
