# Architecture

One window, four routed pages (Feed, Tracker, Sources, Settings). All network
I/O, parsing, and storage live in the Electron main process; the renderer is a
pure read/act client over typed IPC. This document maps the moving parts to
the code.

> For the AI/email-agent path in depth — how an inbox email becomes a feed job
> through the on-device LLM, with flow diagrams — see
> [`AI-ARCHITECTURE.md`](AI-ARCHITECTURE.md).

## Process split

Job boards don't send CORS headers, and some (RemoteOK, WWR) have historically
403'd non-browser user agents — so unlike a browser app, nothing fetches from
the renderer. Everything flows one way:

```
┌────────────────────────── main process ──────────────────────────┐
│  Scheduler (src/main/sync.ts) ─▶ SyncEngine ─▶ Provider plugins  │
│  (30-min tick, manual Sync now)   (engine.ts)  (BA, Arbeitnow,   │
│                                                Himalayas,        │
│                                                RemoteOK, WWR,    │
│                                                Adzuna)           │
│      raw JSON/RSS ─▶ zod validate ─▶ normalize ─▶ classify       │
│                    ─▶ dedupe ─▶ upsert PGlite (Drizzle)          │
│  IPC handles: db:* sources:* sync:* settings:*                   │
│  push events: 'sync:event' via webContents.send                  │
└──────────────────────────────────────────────────────────────────┘
                  ▲ typed preload bridge (window.electron)
┌────────────────────── renderer ──────────────────────────────────┐
│  TanStack Query (@data: queries/mutations/keys over IPC)         │
│  TanStack Router pages: Feed · Tracker · Sources · Settings      │
│  @ui-kit components · VZ5 theme · virtualized feed               │
└──────────────────────────────────────────────────────────────────┘
```

Entry points:

- `src/main/index.ts` — window, menu, security guards, DB creation, IPC
  registration, sync installation. Kept deliberately thin; logic lives in
  `modules/`.
- `src/preload/index.ts` + `src/preload/electron-api.d.ts` — the bridge and
  its hand-maintained type contract.
- `src/renderer/main.tsx` — mounts `@app` (router + providers).

## Module layers (Biome-enforced)

Modules live under `modules/`, one path alias each (`@ui-kit`, `@data`, …),
kept in sync across `electron.vite.config.ts`, `tsconfig.*.json`, and
`vitest.config.ts`. Layer rules are enforced by Biome `noRestrictedImports`
overrides in `biome.json` — an illegal import is a lint error, not a
convention:

| Layer | Modules | May import |
|---|---|---|
| L0 | `logger` | nothing app-side |
| L1 | `ui-kit`, `data`, `sources`, `persistence` | `@logger` only; `ui-kit` and `data` can never import each other |
| L2 | `test-utils` | L0–L1 |
| L3 | `feed`, `tracker`, `sources-page`, `settings`, `shell` | L0–L2; features never import each other |
| L4 | `app` | everything (the only place features compose) |

Two cross-cutting rules ride along in the same overrides: renderer code never
imports `@sources/main` / `@persistence/main` / `@logger/main`, and main
process code (`src/main`, `src/preload`, the `main/` halves of modules) never
imports renderer modules.

## IPC conventions

- **Channels** are kebab-case `ipcMain.handle` names grouped by namespace:
  `db:jobs:list`, `db:jobs:set-status`, `sources:set-key`, `sync:now`,
  `settings:get`, ….
- **Every invoke resolves to `IpcResult<T>`**
  (`modules/sources/shared/ipc.ts`): `{ success: true, data }` or
  `{ success: false, error }`. Errors are values — nothing throws across the
  bridge. The renderer unwraps in `modules/data/ipc.ts`, which *does* throw so
  TanStack Query's error states work off one convention.
- **Push events** go through `webContents.send('sync:event', …)`; the preload
  exposes `window.electron.sync.onEvent(cb)` returning an unsubscribe closure.
  `modules/data/hooks/use-sync-events.ts` turns them into query invalidations.
- **The contract is hand-typed** in `src/preload/electron-api.d.ts`. Every new
  channel is declared there and mirrored in the test mock
  (`modules/test-utils/mocks/electron.ts`) — the renderer only ever touches
  `window.electron`.

## Data flow

1. **Providers** (`modules/sources/main/providers/*.ts`) — one file per
   source: a `meta` object (attribution, politeness budget), `fetch()` (raw
   pages/feeds via `PoliteHttpClient`, no parsing decisions), and `parse()`
   (zod at the boundary; a malformed body yields an empty batch, one odd job
   never sinks the rest). Contract in `modules/sources/main/types.ts`,
   registry in `registry.ts`.
2. **Engine** (`modules/sources/main/engine.ts`) — runs providers
   sequentially, isolated: one provider failing records its `sync_runs` error
   while the rest still land. Pure and dependency-injected — no electron
   imports — so tests drive it against in-memory PGlite. The electron glue
   (scheduler, single-flight guard, `sync:*` IPC, broadcast) is
   `src/main/sync.ts`.
3. **PGlite + Drizzle** (`modules/persistence/main/`) — schema (`jobs`,
   `sync_runs`, `provider_state`), repositories, migrations. Upsert key is the
   job `id` (`${sourceId}:${sourceJobId}`); cross-source dedupe groups by
   `dedupeKey` at query time.
4. **IPC** — repositories are exposed through the handlers in
   `src/main/ipc/`.
5. **TanStack Query** (`modules/data/`) — the single source of truth for all
   renderer state. Hierarchical key factory in `keys.ts`, named query/mutation
   hooks in `queries/` and `mutations/`. localStorage persistence covers only
   the `settings` and `local` namespaces (`client.ts`): the local database
   *is* the job cache, so feed/detail queries always re-read it.

## tsconfig split

Three configs (`tsconfig.json` is just project references):

- `tsconfig.node.json` — `src/main`, `src/preload`, `modules/logger`,
  `modules/sources/{shared,main}`, `modules/persistence/main`. Node types, no
  DOM.
- `tsconfig.web.json` — everything renderer-side plus `modules/*/shared`
  code, with `isolatedDeclarations` (explicit types on every export). The
  `main/` halves are excluded here.
- `modules/sources/shared/` compiles under **both** — types and validation
  helpers usable from either process. Never put process-specific imports
  there.

`pnpm typecheck` runs the web config with `--emitDeclarationOnly` (that's what
makes `isolatedDeclarations` bite) plus a `--noEmit` node pass.

## Why PGlite

PGlite (WASM Postgres) deliberately replaces better-sqlite3
(`modules/persistence/main/db.ts`): a native module has to be rebuilt against
each Electron ABI (`electron-rebuild`, pinned version pairs, and a class of
"works in dev, crashes packaged" failures), while WASM has no native ABI at
all. Bonus: vitest runs the very same engine in-memory, so main-process
repositories and tests share one database implementation. The packaging cost
is small: `node_modules/@electric-sql/pglite` is asar-unpacked and the
`drizzle/` migrations folder ships via `extraResources` (see `package.json`
`build` and PLAN.md §4.5 — packaged builds resolve it from
`process.resourcesPath`).

## Security hardening

- `contextIsolation: true`, `nodeIntegration: false`; window-open and
  will-navigate guards in `src/main/security.ts` — external links only via
  `shell.openExternal`.
- Production CSP with `connect-src 'self'` — free, because all network I/O
  lives in main.
- Job description HTML is sanitized with a DOMPurify allowlist before render
  (formatting tags only); anchor clicks in the detail pane are intercepted and
  forwarded to `shell.openExternal`.
- Adzuna keys are `safeStorage`-encrypted at rest; decrypted values never
  cross the bridge (`SourceInfo.hasKey` is a boolean by design).

## Where to look

| Question | File |
|---|---|
| Provider contract | `modules/sources/main/types.ts` |
| Add a source | `.claude/skills/add-job-source/SKILL.md`, `docs/SOURCES.md` |
| Canonical job model | `modules/sources/shared/job.ts` |
| Politeness client | `modules/sources/main/http.ts` |
| Dedupe/normalize/classify | `modules/sources/main/{normalize,classify}.ts` |
| DB schema | `modules/persistence/main/schema.ts` |
| Query keys + persistence | `modules/data/{keys,client}.ts` |
| Theme pipeline | `docs/THEMING.md`, `scripts/generate-theme.mjs` |
| Release pipeline | `docs/RELEASING.md` |
