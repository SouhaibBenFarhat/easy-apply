# Sources

The per-provider quirk sheet. Everything here was live-verified on 2026-07-20
(`planning/research/research-jobSources.json`); the provider files under
`modules/sources/main/providers/` carry the same notes next to the code.
Fixtures are the captured live responses in `modules/test-utils/fixtures/` —
ground truth over any docs.

## Politeness budgets

From each provider's `meta.politeness` (enforced by the sync engine — the
budget lives in code, not in prose):

| Source | `minIntervalMinutes` | `maxRequestsPerSync` | Attribution required |
|---|---|---|---|
| Arbeitsagentur (`ba`) | 60 | 4 | no |
| Arbeitnow | 60 | 3 | no |
| Himalayas | 60 | 3 | **yes** |
| RemoteOK | 120 | 1 | **yes** |
| WeWorkRemotely | 120 | 2 | no |
| Adzuna | 60 | 4 | **yes** ("Jobs by Adzuna") |

On top of that, `PoliteHttpClient` (`modules/sources/main/http.ts`) spaces
consecutive requests (1.2s gap during sync), sends a browser user agent,
retries only 429/5xx with backoff, and providers run sequentially — never in
parallel. The detail pane's "via {Source} ↗" link satisfies attribution by
design.

## Arbeitsagentur (BA Jobsuche) — `providers/ba.ts`

- Search is **v6**: `https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs`.
  Details remain **v4** (`/pc/v4/jobdetails/{base64url(refnr)}`) — unused in
  v1, the v6 list has no description.
- Auth is a single **static header** `X-API-Key: jobboerse-jobsuche` — public,
  not a secret, no registration. Unofficial but tolerated: it powers
  arbeitsagentur.de's own search.
- Remote-filter quirks (empirically verified): `homeoffice=true` → **HTTP
  500**; the community-documented `arbeitszeit=ho` is unreliable in v6 (0 hits
  for Munich software jobs that demonstrably exist); the working server-side
  filter is the undocumented **`homeoffice=nv_true`** (count matches
  `facetten.homeoffice.counts.nv_true` exactly). The provider needs none of
  them: every job carries `homeofficemoeglich: boolean`, mapped to
  hybrid/onsite.
- The API renamed its whole schema between v4 and v6 — the zod schema pins the
  observed v6 field names (`stellenangebotsTitel`, `firma`,
  `referenznummer`, …).
- Salary: `verguetungsangabe` is ~always `KEINE_ANGABEN`; any real free text
  is kept as `salary.raw`, never number-parsed.

## Arbeitnow — `providers/arbeitnow.ts`

- Free, no auth, Laravel-style pagination (`links.next` null on the last
  page).
- **No working server-side location filter** (`?location=` appears in the
  API's own links but does not filter) — Munich/Deutschlandweit/remote
  filtering happens client-side, umlaut-folded (`München` ≡ `Munich`).
- **Schema drift is real**: the live payload silently dropped the documented
  salary and `visa_sponsorship` fields. The zod schema is all-optional + loose
  on purpose; a re-appearing field is a test-visible event, not a crash.
- `created_at` is unix seconds; `remote: true` is authoritative,
  `remote: false` is not (hybrid detection falls back to the text heuristic).

## Himalayas — `providers/himalayas.ts`

- `https://himalayas.app/jobs/api/search` with **`country=DE`** — the best
  server-side "remote job open to Germany" filter of all surveyed boards. Not
  airtight: `locationRestrictions` is still checked per job, and US-only jobs
  are dropped.
- Pages are hard-capped at **20 jobs**; excess bursts get **429s** — pages are
  walked sequentially inside the politeness budget, a short page ends the
  walk.
- **Attribution is contractual**: link back and credit Himalayas.
- Live field-name nit: the API serves `categories` (docs said `category`).
  Structured salary: `minSalary`/`maxSalary`/`salaryPeriod`/`currency`.
- The committed fixture is **synthetic** (`himalayas.synthetic.json`) — no
  real capture existed at P0; replace it with a live capture when convenient.

## RemoteOK — `providers/remoteok.ts`

- One GET, the latest ~100 jobs, no pagination. **Element `[0]` of the array
  is a legal/ToS object, not a job** — it demands a followed link back and
  naming Remote OK as the source (hence `attribution.required: true`). The
  parser skips it naturally (no id/position/company).
- `salary_min`/`salary_max` are integers where **0 means "not stated"**;
  when present they are annual USD.
- Historically **403'd non-browser user agents** (not reproduced live, kept
  defensively — `PoliteHttpClient` always sends a Chrome UA).
- `location` is messy free text (a real capture contained `"Good Night, "`) —
  classification is conservative: blank = worldwide, unmappable = skip.

## WeWorkRemotely — `providers/wwr.ts`

- Two RSS feeds per sync: `remote-programming-jobs.rss` + the all-jobs
  `remote-jobs.rss` (the former is a subset — ids are deduped across both).
- The custom **`<region>` element is the only scope signal**; "Anywhere in
  the World" is the usable bucket (~74% of items), the rest are mostly
  US-state restrictions → skipped.
- Item titles are `Company: Role`; the HTML description arrives
  **XML-entity-encoded** rather than CDATA-wrapped — the parser decodes
  exactly that one layer.
- Same browser-UA note as RemoteOK. Salary: essentially never structured
  (1 of 16 sampled items, prose only).

## Adzuna — `providers/adzuna.ts`

- The **only Munich source with systematic salary numbers**. Requires a free
  `app_id`/`app_key` pair from developer.adzuna.com → `enabledByDefault:
  false`; keys are safeStorage-encrypted and decrypted only in the main
  process.
- For Germany most numbers are **model-predicted**: `salary_is_predicted`
  (arrives as string `'1'`/`'0'` live, number in docs — both accepted) maps to
  `salary.isEstimated`, rendered as "~ est." in the feed. `salary_min/max` of
  0 means "no data".
- **Free-tier limits**: 25 hits/min, 250/day, **1,000/week** (the binding
  constraint), 2,500/month. The politeness budget (4 requests/sync, hourly
  minimum interval) stays far inside them.
- Quirks: the page number is a **path segment** (`/search/1`), not a query
  param; the key travels in the query string, so **log messages must never
  include the URL**.
- The committed fixture is **synthetic** (`adzuna.synthetic.json`) — the live
  endpoint answers `AUTH_FAIL` without a key.

## Re-capturing fixtures

Fixtures live in `modules/test-utils/fixtures/`. Re-capture when a provider
test starts failing against the live API (schema drift). Mark synthetic
fixtures in the filename (`*.synthetic.json`); prefer real captures.

```bash
cd modules/test-utils/fixtures
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

# BA v6 — plain Munich search
curl -s -H 'X-API-Key: jobboerse-jobsuche' \
  'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs?was=software&wo=M%C3%BCnchen&umkreis=25&size=100&page=1' \
  > ba_v6.json

# BA v6 — the homeoffice=nv_true variant (kept as a regression capture)
curl -s -H 'X-API-Key: jobboerse-jobsuche' \
  'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs?was=software&wo=M%C3%BCnchen&umkreis=25&size=100&page=1&homeoffice=nv_true' \
  > ba_ho.json

# Arbeitnow
curl -s 'https://www.arbeitnow.com/api/job-board-api?page=1' > arbeitnow.json

# Himalayas (replaces the synthetic fixture — update the test's filename too)
curl -s 'https://himalayas.app/jobs/api/search?country=DE&q=software&page=1' > himalayas.json

# RemoteOK (browser UA required)
curl -s -A "$UA" 'https://remoteok.com/api' > remoteok.json

# WeWorkRemotely (browser UA required; the programming feed is the fixture)
curl -s -A "$UA" 'https://weworkremotely.com/categories/remote-programming-jobs.rss' > wwr.rss

# Adzuna (needs your own key pair; replaces the synthetic fixture)
curl -s "https://api.adzuna.com/v1/api/jobs/de/search/1?app_id=$APP_ID&app_key=$APP_KEY&what=software&where=M%C3%BCnchen&distance=25&results_per_page=50&sort_by=date&max_days_old=30" \
  > adzuna.json
```

`muse.json` and `landingjobs.json` are Tier-2 captures (The Muse,
Landing.jobs) kept for the post-v1 providers; nothing reads them yet.

## Adding a source

Follow the `add-job-source` skill (`.claude/skills/add-job-source/SKILL.md`).
Short version — adding a source touches exactly:

1. the `SourceId` union in `modules/sources/shared/job.ts` (Tier-2 ids are
   already there),
2. `modules/sources/main/providers/<id>.ts` — meta + fetch + parse, zod
   module-internal,
3. a fixture in `modules/test-utils/fixtures/` (real capture preferred;
   synthetic marked in the filename),
4. the `PROVIDERS` array in `modules/sources/main/registry.ts`,
5. a fixture-driven test next to the provider,
6. the `DEFAULT_SOURCES` seed in `modules/test-utils/mocks/electron.ts`,
7. a quirk section + politeness row + re-capture curl in this file.
