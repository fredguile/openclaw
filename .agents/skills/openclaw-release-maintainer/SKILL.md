---
name: openclaw-release-maintainer
description: Maintainer workflow for fork releases, prereleases, changelog release notes, and publish validation for @fredguile/openclaw. Use when Codex needs to prepare or verify stable or verified release steps, align version naming, assemble release notes, check release auth requirements, or validate publish-time commands and artifacts.
---

# @fredguile/openclaw Release Maintainer

Use this skill for release and publish-time workflow on the fork at `https://github.com/fredguile/openclaw`. Keep ordinary development changes and GHSA-specific advisory work outside this skill.

## Fork identity

- This repo is a personal fork of `https://github.com/openclaw/openclaw`.
- NPM package: `@fredguile/openclaw`
- GitHub repo: `fredguile/openclaw`
- All releases, tags, and issues belong to the fork only. Do not open PRs or issues against the upstream `openclaw/openclaw` repo.

## Respect release guardrails

- Do not change version numbers without explicit operator approval.
- Ask permission before any npm publish or release step.
- This skill should be sufficient to drive the normal release flow end-to-end.
- Use `docs/reference/RELEASING.md` for public release policy.

## Upstream sync before release

- Before cutting a `verified` release, ensure upstream changes are integrated:
  ```bash
  git fetch upstream
  git merge upstream/main
  ```
- Resolve merge conflicts preferring upstream's changes for shared/core code unless the fork has intentional divergences.
- Run the full verification suite after merge to confirm fork features still work with the integrated upstream code.

## Release channels and tag conventions

The fork uses three release channels:

### `beta` — prerelease

- Tag format: `vYYYY.M.D-beta.N`
- Release title: `openclaw YYYY.M.D-beta.N`
- Published to npm dist-tag `beta`
- Used for testing new features before a verified release

### `verified` — fork stable (upstream + fork features)

- Tag format: `vYYYY.M.D-verified.N`
- Release title: `openclaw YYYY.M.D-verified.N`
- Published to npm dist-tag `verified` (and `beta`)
- Meaning: upstream release `vYYYY.M.D` (or `vYYYY.M.D.N`) has been pulled into the fork, verified against the fork's own features, and released as a fork-specific stable version.
- The `.N` suffix is the fork's own revision counter for that upstream base version (e.g., `v2026.4.15-verified.1` is the first verified release based on upstream `v2026.4.15`).
- This is the primary release channel for the fork.

### Tag naming rules

- Prefer `-beta.N` for prereleases; do not mint arbitrary suffixes.
- Prefer `-verified.N` for fork stable releases.
- The `N` in both suffixes is a monotonic counter starting at `1`.
- When a new upstream base version is integrated, reset the counter to `1` (e.g., after `v2026.4.15-verified.3`, the next upstream sync to `v2026.4.22` starts at `v2026.4.22-verified.1`).
- When using a beta or verified Git tag, publish npm with the matching version suffix so the plain version is not consumed or blocked.

## Handle versions and release files consistently

- Version locations include:
  - `package.json`
  - `apps/android/app/build.gradle.kts`
  - `apps/ios/Sources/Info.plist`
  - `apps/ios/Tests/Info.plist`
  - `apps/macos/Sources/OpenClaw/Resources/Info.plist`
  - `docs/install/updating.md`
  - Peekaboo Xcode project and plist version fields
- Before creating a release tag, make every version location above match the version encoded by that tag.
- For verified tags like `vYYYY.M.D-verified.N`, the repo version locations should reflect `YYYY.M.D-verified.N` (the full fork version, not just the upstream base).
- "Bump version everywhere" means all version locations above except `appcast.xml`.

## Build changelog-backed release notes

- Changelog entries should be user-facing, not internal release-process notes.
- When cutting a beta release:
  - Tag `vYYYY.M.D-beta.N` from the release commit
  - Create a prerelease titled `openclaw YYYY.M.D-beta.N`
  - Use release notes from the matching `CHANGELOG.md` version section
- When cutting a verified release:
  - Tag `vYYYY.M.D-verified.N` from the release commit
  - Create a release titled `openclaw YYYY.M.D-verified.N`
  - Use release notes from the matching `CHANGELOG.md` version section
  - Include a summary of upstream changes integrated since the last verified release
- Keep the top version entries in `CHANGELOG.md` sorted by impact:
  - `### Changes` first
  - `### Fixes` deduped with user-facing fixes first
- Changelog placement: in the active version block, append new entries to the end of the target section; do not insert at the top.

## Run publish-time validation

Before tagging or publishing, run:

```bash
pnpm build
pnpm ui:build
pnpm release:check
pnpm test:install:smoke
```

For a non-root smoke path:

```bash
OPENCLAW_INSTALL_SMOKE_SKIP_NONROOT=1 pnpm test:install:smoke
```

After npm publish, run:

```bash
node --import tsx scripts/openclaw-npm-postpublish-verify.ts <published-version>
```

- This verifies the published registry install path in a fresh temp prefix.
- For stable correction releases like `YYYY.M.D-N`, it also verifies the
  upgrade path from `YYYY.M.D` to `YYYY.M.D-N` so a correction publish cannot
  silently leave existing global installs on the old base stable payload.
- Treat install smoke as a pack-budget gate too. `pnpm test:install:smoke`
  now fails the candidate update tarball when npm reports an oversized
  `unpackedSize`, so release-time e2e cannot miss pack bloat that would risk
  low-memory install/startup failures.
- Keep direct npm global coverage enabled in install smoke. It exercises plain
  `npm install -g <candidate>` fresh installs and npm-driven update installs,
  because many users install with npm even when docs prefer pnpm.
- Use `pnpm test:live:media video` for bounded video-provider smoke when video
  generation is in release scope. The default video smoke skips `fal`, runs one
  text-to-video attempt per provider with a one-second lobster prompt, and caps
  each provider operation with `OPENCLAW_LIVE_VIDEO_GENERATION_TIMEOUT_MS`
  (`180000` by default).
- Run `pnpm test:live:media video --video-providers fal` only when FAL-specific
  proof is required. Its queue latency can dominate release time.
- Set `OPENCLAW_LIVE_VIDEO_GENERATION_FULL_MODES=1` only when intentionally
  validating the slower image-to-video and video-to-video transform lanes.

## Check all relevant release builds

- Always validate the npm release path before creating the tag.
- Default release checks:
  - `pnpm check`
  - `pnpm build`
  - `pnpm ui:build`
  - `pnpm release:check`
  - `OPENCLAW_INSTALL_SMOKE_SKIP_NONROOT=1 pnpm test:install:smoke`
- Check all release-related build surfaces touched by the release, not only the npm package.
- For beta-style full e2e batteries, hard-cap top-level long lanes instead of letting them run indefinitely. Use host `timeout --foreground`/`gtimeout --foreground` caps such as:
  - `45m` for `OPENCLAW_INSTALL_SMOKE_SKIP_NONROOT=1 pnpm test:install:smoke`
  - `90m` for `pnpm test:docker:all`
  - Parallels caps from the `openclaw-parallels-smoke` skill
    If a lane hits its cap, stop and inspect/fix the affected lane before continuing; do not continue to wait on the same process.
- Actual npm install/update phases are capped at 5 minutes. If `npm install -g`, installer package install, or `openclaw update` takes longer than 300s in release e2e, stop treating the run as healthy progress and debug the installer/updater or harness.
- Serialize host build/package mutations ahead of VM lanes. Finish `pnpm build`, `pnpm ui:build`, `pnpm release:check`, install smoke, and any Docker/package-prep lanes before starting Parallels `npm pack` lanes; otherwise `dist` can disappear during VM pack prep and produce false failures.
- Include mac release readiness in preflight by running the public validation
  workflow in `openclaw/openclaw` and the real mac preflight in
  `openclaw/releases-private` for every release.
- Treat the `appcast.xml` update on `main` as part of mac release readiness, not an optional follow-up.
- The workflows remain tag-based. The agent is responsible for making sure
  preflight runs complete successfully before any publish run starts.
- Any fix after preflight means a new commit. Delete and recreate the tag and
  matching GitHub release from the fixed commit, then rerun preflight from
  scratch before publishing.
- For stable mac releases, generate the signed `appcast.xml` before uploading
  public release assets so the updater feed cannot lag the published binaries.
- Serialize stable appcast-producing runs across tags so two releases do not
  generate replacement `appcast.xml` files from the same stale seed.
- For stable releases, confirm the latest beta already passed the broader release workflows before cutting stable.
- If any required build, packaging step, or release workflow is red, do not say the release is ready.

## npm publish for the fork

- The fork publishes as `@fredguile/openclaw` on npm.
- First publish of a scoped package requires `--access public` (subsequent publishes remember it).
- Beta releases publish with `--tag beta`:
  ```bash
  npm publish --access public --tag beta
  ```
- Verified releases: npm treats `-verified.N` as a semver prerelease, so publish under an explicit tag first, then point `latest` at it:
  ```bash
  npm publish --access public --tag verified
  npm dist-tag add @fredguile/openclaw@<version> latest
  npm dist-tag add @fredguile/openclaw@<version> beta
  ```
- The publish workflow is manual. Creating or pushing a tag does not publish by itself.

## Run the release sequence

### Beta release

1. Confirm the operator explicitly wants to cut a beta release.
2. Choose the exact target version and git tag: `vYYYY.M.D-beta.N`.
3. Make every repo version location match that tag before creating it.
4. Update `CHANGELOG.md` and assemble the matching GitHub release notes.
5. Run the full preflight:
   ```bash
   pnpm check
   pnpm build
   pnpm ui:build
   pnpm release:check
   OPENCLAW_INSTALL_SMOKE_SKIP_NONROOT=1 pnpm test:install:smoke
   ```
6. Confirm the target npm version is not already published.
7. Create and push the git tag.
8. Create or refresh the matching GitHub prerelease titled `openclaw YYYY.M.D-beta.N`.
9. Publish to npm: `npm publish --tag beta`.
10. Verify npm package and release assets.

### Verified release

1. Confirm the operator explicitly wants to cut a verified release.
2. Sync upstream changes if not already done:
   ```bash
   git fetch upstream
   git merge upstream/main
   ```
3. Resolve any merge conflicts (prefer upstream for shared/core code; preserve fork divergences).
4. Run full test suite to confirm fork features work with integrated upstream code:
   ```bash
   pnpm check
   pnpm test
   pnpm build
   ```
5. Choose the exact target version and git tag: `vYYYY.M.D-verified.N`.
6. Make every repo version location match that tag before creating it.
7. Update `CHANGELOG.md` with:
   - Fork-specific changes
   - Summary of upstream changes integrated since the last verified release
8. Run the full preflight:
   ```bash
   pnpm check
   pnpm build
   pnpm ui:build
   pnpm release:check
   OPENCLAW_INSTALL_SMOKE_SKIP_NONROOT=1 pnpm test:install:smoke
   ```
9. Confirm the target npm version is not already published.
10. Create and push the git tag.
11. Create or refresh the matching GitHub release titled `openclaw YYYY.M.D-verified.N`.
12. Publish to npm:
    ```bash
    npm publish --access public --tag verified
    npm dist-tag add @fredguile/openclaw@<version> latest
    npm dist-tag add @fredguile/openclaw@<version> beta
    ```
13. Verify npm package and release assets.

## GHSA advisory work

- Use `openclaw-ghsa-maintainer` for GHSA advisory inspection, patch/publish flow, private-fork validation, and GHSA API-specific publish checks.
