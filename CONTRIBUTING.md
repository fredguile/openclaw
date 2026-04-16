# Contributing to OpenClaw

Welcome to the lobster tank! 🦞

## Quick Links

- **GitHub:** https://github.com/fredguile/openclaw
- **Vision:** [`VISION.md`](VISION.md)

## Maintainers

- Fred Ghilini - Fork maintainer
  - GitHub: @fredguile

## How to Contribute

Before considering opening a PR in this fork, you should consider contributing to the upstream project first.

I am open to review PRs to a certain degree (and with limited capacity) if you manage to explain why your change should land into my fork rather than in the upstream project.

## Before You PR

- Test locally with your OpenClaw instance
- Run tests: `pnpm build && pnpm check && pnpm test`
- For iterative local commits, `scripts/committer --fast "message" <files...>` passes `FAST_COMMIT=1` through to the pre-commit hook so it skips the repo-wide `pnpm check`. Only use it when you've already run equivalent targeted validation for the touched surface.
- For extension/plugin changes, run the fast local lane first:
  - `pnpm test:extension <extension-name>`
  - `pnpm test:extension --list` to see valid extension ids
  - If you changed shared plugin or channel surfaces, run `pnpm test:contracts`
  - For targeted shared-surface work, use `pnpm test:contracts:channels` or `pnpm test:contracts:plugins`
  - These commands also cover the shared seam/smoke files that the default unit lane skips
  - If you changed broader runtime behavior, still run the relevant wider lanes (`pnpm test:extensions`, `pnpm test:channels`, or `pnpm test`) before asking for review
- If you touched bundled-plugin boundaries in shared code, run the matching inventories:
  - `node scripts/check-src-extension-import-boundary.mjs --json` for `src/**`
  - `node scripts/check-sdk-package-extension-import-boundary.mjs --json` for `src/plugin-sdk/**` and `packages/**`
  - `node scripts/check-test-helper-extension-import-boundary.mjs --json` for `test/helpers/**`
- Shared test helpers must use `src/test-utils/bundled-plugin-public-surface.ts` instead of repo-relative `extensions/**` imports. Keep plugin-local deep mocks inside the owning bundled plugin package.
- If you have access to Codex, run `codex review --base origin/main` locally before opening or updating your PR. Treat this as the current highest standard of AI review, even if GitHub Codex review also runs.
- Do not submit refactor-only PRs unless a maintainer explicitly requested that refactor for an active fix or deliverable.
- Do not submit test or CI-config fixes for failures already red on `main` CI. If a failure is already visible in the [main branch CI runs](https://github.com/fredguile/openclaw/actions), it's a known issue the Maintainer team is tracking, and a PR that only addresses those failures will be closed automatically. If you spot a _new_ regression not yet shown in main CI, report it as an issue first.
- Do not submit test-only PRs that just try to make known `main` CI failures pass. Test changes are acceptable when they are required to validate a new fix or cover new behavior in the same PR.
- Ensure CI checks pass
- Keep PRs focused (one thing per PR; do not mix unrelated concerns)
- Describe what & why
- Reply to or resolve bot review conversations you addressed before asking for review again
- **Include screenshots** — one showing the problem/before, one showing the fix/after (for UI or visual changes)
- Use American English spelling and grammar in code, comments, docs, and UI strings
- Do not edit files covered by `CODEOWNERS` security ownership unless a listed owner explicitly asked for the change or is already reviewing it with you. Treat those paths as restricted review surfaces, not opportunistic cleanup targets.

## Review Conversations Are Author-Owned

If a review bot leaves review conversations on your PR, you are expected to handle the follow-through:

- Resolve the conversation yourself once the code or explanation fully addresses the bot's concern
- Reply and leave it open only when you need maintainer or reviewer judgment
- Do not leave "fixed" bot review conversations for maintainers to clean up for you
- If Codex leaves comments, address every relevant one or resolve it with a short explanation when it is not applicable to your change
- If GitHub Codex review does not trigger for some reason, run `codex review --base origin/main` locally anyway and treat that output as required review work

This applies to both human-authored and AI-assisted PRs.

## Control UI Decorators

The Control UI uses Lit with **legacy** decorators (current Rollup parsing does not support
`accessor` fields required for standard decorators). When adding reactive fields, keep the
legacy style:

```ts
@state() foo = "bar";
@property({ type: Number }) count = 0;
```

The root `tsconfig.json` is configured for legacy decorators (`experimentalDecorators: true`)
with `useDefineForClassFields: false`. Avoid flipping these unless you are also updating the UI
build tooling to support standard decorators.

## AI/Vibe-Coded PRs Welcome! 🤖

Built with Codex, Claude, or other AI tools? **Awesome - just mark it!**

Please include in your PR:

- [ ] Mark as AI-assisted in the PR title or description
- [ ] Note the degree of testing (untested / lightly tested / fully tested)
- [ ] Include prompts or session logs if possible (super helpful!)
- [ ] Confirm you understand what the code does
- [ ] If you have access to Codex, run `codex review --base origin/main` locally and address the findings before asking for review
- [ ] Resolve or reply to bot review conversations after you address them

AI PRs are first-class citizens here. We just want transparency so reviewers know what to look for. If you are using an LLM coding agent, instruct it to resolve bot review conversations it has addressed instead of leaving them for maintainers.
