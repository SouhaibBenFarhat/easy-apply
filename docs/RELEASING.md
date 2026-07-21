# Releasing EasyApply

The pipeline mirrors gitswitch/easy-copy: Release Drafter maintains a rolling
draft, publishing it triggers the build, and CI bumps the Homebrew cask. After
clicking **Publish** there are no manual steps.

## The ritual

1. **Merge PRs with Conventional-Commit titles** (`feat:`, `fix:`, `chore:`, …).
   Squash-merge uses the PR title; the Release Drafter autolabeler maps it to a
   semver label (`feat` → minor, `fix`/`chore` → patch, `!`/`BREAKING CHANGE` →
   major).
2. **Release Drafter keeps the draft current** — every merge to `main` updates
   the draft release notes and the resolved `vX.Y.Z` tag.
3. **Publish the draft** (GitHub → Releases → edit draft → Publish release).
   This fires `.github/workflows/release.yml`.
4. **CI builds and attaches `EasyApply-arm64.dmg`** — `electron-vite build` +
   `electron-builder --mac --arm64 --publish always`, with the version stamped
   from the tag via `-c.extraMetadata.version` (package.json stays at a
   placeholder version).
5. **CI bumps the tap** — seds `version` and `sha256` in
   `homebrew-tap/Casks/easyapply.rb` and pushes to `master`.
6. **Verify**: the tap's `master` branch should show a commit
   `easyapply X.Y.Z` authored by `github-actions[bot]`. If the commit is
   missing, the `TAP_GITHUB_TOKEN` secret is absent and the guarded step was
   silently skipped (exactly what happened to easy-copy at v0.1.0).
7. **Install / upgrade**:

   ```bash
   brew install --cask souhaibbenfarhat/tap/easyapply
   # or, if already installed
   brew upgrade --cask easyapply
   ```

## One-time setup (before the first release)

- **The cask is created manually once.** CI only seds `version`/`sha256` in an
  existing `Casks/easyapply.rb`; it never creates the file. Add the cask to
  `SouhaibBenFarhat/homebrew-tap` (branch `master`) following the
  `codelobby.rb` dmg pattern + the gitswitch/easycopy postflight: url template
  `.../releases/download/v#{version}/EasyApply-arm64.dmg`, `livecheck
  { url :url; strategy :github_latest }`, `depends_on arch: :arm64`,
  `app "EasyApply.app"`, postflight `xattr -dr com.apple.quarantine`
  (build is unsigned), `uninstall quit: "com.souhaibbenfarhat.easyapply"`,
  `zap trash:` incl. `~/Library/Application Support/EasyApply`. Keep the
  two-space indent on the `  version "..."` / `  sha256 "..."` lines — the CI
  sed regexes anchor on it.
- **`TAP_GITHUB_TOKEN` repo secret is required** for the tap bump: a
  fine-grained PAT scoped to `SouhaibBenFarhat/homebrew-tap` with
  **Contents: Read and write**. Without it the bump step is skipped (the
  release still gets its dmg).
- Optional `RELEASE_PAT`: makes Release Drafter's draft user-owned instead of
  bot-owned; falls back to `GITHUB_TOKEN`.

## Code signing (future)

The build is currently unsigned (`CSC_IDENTITY_AUTO_DISCOVERY: 'false'` in
release.yml); the cask postflight strips the quarantine flag instead. To ship
signed + notarized builds later:

1. Add repo secrets:
   - `CSC_LINK` — base64-encoded Developer ID Application `.p12`
   - `CSC_KEY_PASSWORD` — the `.p12` passphrase
   - `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` — for
     notarization (electron-builder picks these up automatically)
2. Remove the `CSC_IDENTITY_AUTO_DISCOVERY: 'false'` env from release.yml and
   pass the secrets through to the packaging step.
3. Once notarized, drop the `postflight` quarantine-strip from the cask.

## Packaged-app first-run checklist

After installing a fresh build (or running `pnpm build:mac` locally and
launching `dist/mac-arm64/EasyApply.app`):

- [ ] App launches; window appears with the dark petrol theme (no white flash).
- [ ] `~/Library/Application Support/EasyApply/` is created (userData follows
      `productName`), containing `easyapply-db/` (PGlite data dir).
- [ ] Migrations apply on first launch — no migration errors in
      `ELECTRON_ENABLE_LOGGING=1` output; the `drizzle/` folder is read from
      `Contents/Resources/drizzle` (extraResources), resolved via
      `process.resourcesPath` in `src/main/index.ts`.
- [ ] First sync populates the feed — `[sync]` log lines show providers
      completing and jobs upserted.
- [ ] Relaunch: window bounds restored, feed served from the local DB
      instantly.

## Local packaging commands

```bash
pnpm build:unpack   # electron-vite build + unpacked dist/mac-arm64 (fast check)
pnpm build:mac      # full dmg at dist/EasyApply-arm64.dmg
```
