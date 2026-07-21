<p align="center"><img src="build/icon-1024.png" width="128" alt="EasyApply icon"></p>
<h1 align="center">EasyApply</h1>
<p align="center">Every job worth applying to — Munich and remote Europe — in one fast feed.</p>
<p align="center"><a href="https://souhaibbenfarhat.github.io/easy-apply"><strong>easyapply product page →</strong></a></p>

---

Job hunting means six tabs, six logins, and the same posting three times. EasyApply pulls Munich on-site/hybrid roles and remote-in-Europe roles from every source with a real API into one deduplicated, newest-first feed on your Mac. It also reads your job-alert inbox with an on-device LLM, so postings that only ever arrive by email land in the same feed.

## Features

- **Six sources, one feed** — Arbeitsagentur, Adzuna, Arbeitnow, Himalayas, RemoteOK, WeWorkRemotely. Official APIs and feeds only, no scraping.
- **Your job-alert inbox** — connect a Gmail account (IMAP + App Password) and an on-device LLM reads every recent email, extracts the job postings, and tags them by board (LinkedIn, Indeed, StepStone, Xing, …). Local-only and deletable.
- **On-device AI, nothing leaves your Mac** — the model downloads once with a progress bar and runs fully offline. Choose **Llama 3.1 8B** (fast, the default) or **DeepSeek-R1 14B** (a reasoning model), switch anytime, and toggle AI off from the header to free its RAM.
- **Watch the agent work** — an activity panel shows a live funnel (emails scanned → accepted/rejected → jobs found → kept), streams the model's reasoning when it thinks, and offers a **Stop** to cut a run mid-scan.
- **Munich + remote Europe** — a search profile (city, radius, keywords, remote scopes) drives every source; cross-source duplicates collapse into one row.
- **Salary up front** — a copper badge on every posting that states pay; Adzuna's model estimates are marked `~`.
- **Application tracker** — Interested → Applied → Interview → Rejected, with notes. A job is never lost or applied to twice.
- **Polite by design** — per-source rate limits, spaced sequential requests, and a "via {Source} ↗" attribution link on every posting.
- **Everything stays local** — jobs live in a PGlite database on disk, API keys and app passwords are OS-encrypted, no accounts, no telemetry.
- **Native feel** — dark petrol + copper VZ5 palette, glass chrome, Apple system typography.

## Install

```bash
brew install --cask souhaibbenfarhat/tap/easyapply
```

Requires macOS 14+ (Apple Silicon). Not notarized — the cask clears the quarantine flag on install.

## How it works

The Electron main process fetches from the official APIs and feeds on an interval, normalizes and dedupes the results into a local PGlite database, and the React renderer reads it over typed IPC. Nothing leaves the machine except the API requests themselves — keys are encrypted with the OS keychain and jobs, statuses, and notes never sync anywhere.

## Reading your job-alert inbox

Some of the best postings only ever arrive as job-alert emails. EasyApply can read them for you, entirely on-device.

**Connect** — on the Sources page, add a Gmail address and a [Google App Password](https://support.google.com/accounts/answer/185833) (not your login password). Credentials are OS-encrypted, stored only on your Mac, and removable at any time. Multiple accounts are supported.

**How the pipeline works** — on each sync the main process:

1. Reads every recent email over IMAP (last 30 days, up to 200 per run).
2. Hands each email's text to the on-device LLM, which extracts any job postings as structured JSON.
3. Runs a deterministic safety harness on the result — every job is kept only if it has a title, a company, and a real `http(s)` apply link, then deduped. The board it belongs to (LinkedIn, Indeed, StepStone, Xing, …) is inferred from that apply URL. **The model proposes; the code disposes** — a hallucinated posting with no genuine link never reaches your feed.

**Choose your model** — Settings → *On-device AI model*. **Llama 3.1 8B** (~4.9 GB) is the fast default, ideal for the mechanical extraction. **DeepSeek-R1 14B** (~9 GB) is a reasoning model — slower, but it thinks through judgment calls. Each downloads once with a progress bar and runs fully offline; switching unloads the old one to free RAM, and the header toggle turns AI off entirely to reclaim its memory.

**Watch it run** — the header Activity button opens a panel with a live funnel (emails scanned → accepted / rejected → jobs found → kept), the LLM's prompt/response for each email, and — with a reasoning model — its streamed *thinking*. A **Stop** button interrupts a run between emails, keeping whatever it has already found.

Nothing here touches the network except the one-time model download: reading, extracting, and classifying all happen locally.

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
