---
name: release
description: Cut a release — publish the drafted GitHub release, verify the dmg and tap bump, and run the packaged first-run checklist.
---

# Cutting a release

The full pipeline, one-time setup, and future code-signing steps live in
`docs/RELEASING.md` — read it first. This is the operational checklist.

## Checklist

1. All PRs merged with Conventional-Commit titles; Release Drafter's draft
   shows the right `vX.Y.Z` (labels drive semver: `feat` → minor,
   `fix`/`chore` → patch).
2. GitHub → Releases → edit draft → **Publish release**. That fires
   `release.yml` — there are no manual build steps.
3. Verify CI attached `EasyApply-arm64.dmg` to the release.
4. Verify the tap bump: `SouhaibBenFarhat/homebrew-tap` branch `master` has a
   commit `easyapply X.Y.Z` by `github-actions[bot]`. Missing commit =
   `TAP_GITHUB_TOKEN` secret absent and the guarded step silently skipped
   (the easy-copy v0.1.0 failure mode).
5. Install and run the packaged-app first-run checklist from
   `docs/RELEASING.md` (userData DB dir created, migrations apply, first sync
   populates the feed, bounds restored on relaunch):

   ```bash
   brew install --cask souhaibbenfarhat/tap/easyapply
   # or: brew upgrade --cask easyapply
   ```

6. Site check: `site/index.html` specs/version strings still match the
   release.

First release only: the cask file and tap README row are created manually
(CI only seds `version`/`sha256`), and the `TAP_GITHUB_TOKEN` secret must
exist **before** publishing — details in `docs/RELEASING.md`.

Local packaging sanity checks (no release needed):

```bash
pnpm build:unpack   # fast unpacked build in dist/mac-arm64
pnpm build:mac      # full dmg at dist/EasyApply-arm64.dmg
```
