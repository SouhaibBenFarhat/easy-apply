<p align="center"><img src="build/icon-1024.png" width="128" alt="EasyApply icon"></p>
<h1 align="center">EasyApply</h1>
<p align="center">Every job worth applying to — Munich and remote Europe — in one fast feed.</p>
<p align="center"><a href="https://souhaibbenfarhat.github.io/easy-apply"><strong>easyapply product page →</strong></a></p>

---

Job hunting means six tabs, six logins, and the same posting three times. EasyApply pulls Munich on-site/hybrid roles and remote-in-Europe roles from every source with a real API into one deduplicated, newest-first feed on your Mac.

## Features

- **Six sources, one feed** — Arbeitsagentur, Adzuna, Arbeitnow, Himalayas, RemoteOK, WeWorkRemotely. Official APIs and feeds only, no scraping.
- **Munich + remote Europe** — a search profile (city, radius, keywords, remote scopes) drives every source; cross-source duplicates collapse into one row.
- **Salary up front** — a copper badge on every posting that states pay; Adzuna's model estimates are marked `~`.
- **Application tracker** — Interested → Applied → Interview → Rejected, with notes. A job is never lost or applied to twice.
- **Polite by design** — per-source rate limits, spaced sequential requests, and a "via {Source} ↗" attribution link on every posting.
- **Everything stays local** — jobs live in a PGlite database on disk, API keys are OS-encrypted, no accounts, no telemetry.
- **Native feel** — dark petrol + copper VZ5 palette, glass chrome, Apple system typography.

## Install

```bash
brew install --cask souhaibbenfarhat/tap/easyapply
```

Requires macOS 14+ (Apple Silicon). Not notarized — the cask clears the quarantine flag on install.

## How it works

The Electron main process fetches from the official APIs and feeds on an interval, normalizes and dedupes the results into a local PGlite database, and the React renderer reads it over typed IPC. Nothing leaves the machine except the API requests themselves — keys are encrypted with the OS keychain and jobs, statuses, and notes never sync anywhere.

## Build from source

```bash
git clone https://github.com/SouhaibBenFarhat/easy-apply.git
cd easy-apply
pnpm install
pnpm dev
```

Run the tests with `pnpm test`; package a dmg with `pnpm build:mac`.

## License

MIT
