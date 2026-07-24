---
name: add-job-source
description: Add a new job-source provider — SourceId union, provider file with meta/fetch/parse, fixture, registry, tests, mock seed, and docs row.
---

# Adding a job source

A provider is one file + one fixture + one test. Quirks per existing source:
`docs/SOURCES.md`. Contract: `modules/sources/main/types.ts`. Use
`providers/himalayas.ts` (paginated JSON) or `providers/wwr.ts` (RSS/text) as
the closest template.

## Checklist

1. **SourceId** — add the id to the `SourceId` union *and* `SOURCE_IDS` array
   in `modules/sources/shared/job.ts` (Tier-2 ids `remotive`, `jooble`,
   `landingjobs`, `themuse` are already reserved there).
2. **Provider** — `modules/sources/main/providers/<id>.ts` exporting a
   `JobSourceProvider`:
   - `meta`: `id`, `displayName`, `homepage`, `enabledByDefault` (keyless →
     `true`), `attribution` (check the source's ToS — RemoteOK/Himalayas/
     require it), `politeness` (`minIntervalMinutes`,
     `maxRequestsPerSync` — the budget lives HERE, nowhere else), and
     `requiresKey.fields` if the source needs credentials.
   - `fetch(ctx)`: raw pages/feeds via `ctx.http` (PoliteHttpClient — browser
     UA, spacing, retries come free), driven by `ctx.searchProfile`, requests
     hard-capped by the politeness budget. **No parsing decisions.** Remote
     boards return `[]` when `remoteScopes` is empty. Keyed sources read
     `ctx.config` and skip quietly without one. Never log URLs that carry
     keys.
   - `parse(raw, ctx)`: zod at the boundary — schemas are `z.looseObject`
     with all-optional fields and **stay module-internal** (house rule). A
     malformed body returns `[]`; one odd job `continue`s, never throws. Skip
     unlinkable jobs (no id/url). Dedupe in-batch with a `seen` set. Build
     `NormalizedJob` with `id: '<sourceId>:<sourceKey>'`, helpers from
     `../normalize` (`cleanText`, `toIsoOrNull`, `buildDedupeKey`) and
     `../classify` (`classifyWorkMode`, `classifyRemoteScope`).
3. **Fixture** — `modules/test-utils/fixtures/<id>.json` (or `.rss`). **Real
   capture strongly preferred** — add its `curl` to `docs/SOURCES.md`. If the
   endpoint needs auth you can't exercise, commit a synthetic fixture and mark
   it in the filename: `<id>.synthetic.json`.
4. **Registry** — append to `PROVIDERS` in
   `modules/sources/main/registry.ts`.
5. **Tests** — `providers/<id>.test.ts` with `// @vitest-environment node` on
   line 1. Follow `ba.test.ts`: a fake `ctx` harness recording requests;
   assert fetch URLs/headers/budget, fixture parses to the expected jobs,
   malformed body → `[]`, and the source-specific quirks (the things that
   will break on schema drift).
6. **Mock seed** — add the source's `SourceInfo` row to `DEFAULT_SOURCES` in
   `modules/test-utils/mocks/electron.ts` (same order as the registry) so the
   Sources page shows it in component tests.
7. **Docs** — `docs/SOURCES.md`: quirk section, politeness-table row,
   re-capture curl.

Nothing else should need touching: the engine, IPC, Sources page, and feed all
iterate the registry. If a change leaks outside this list, the abstraction is
being broken — stop and reconsider.

## Verify

```bash
pnpm lint && pnpm typecheck && pnpm test
pnpm dev   # Sources page shows the card; Sync now pulls real jobs
```
