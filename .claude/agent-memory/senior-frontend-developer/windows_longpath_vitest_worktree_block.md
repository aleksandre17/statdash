---
name: windows-longpath-vitest-worktree-block
description: vitest CLI cannot start at all in deeply-nested worktree paths (.claude/worktrees/agent-<id>/platform) on this Windows machine — Node ESM package-imports resolution fails on paths >260 chars; universal/pre-existing, not caused by code changes; verify test logic manually instead
metadata:
  type: project
---

Found 2026-07 while gating a CSS/token fix in a `.claude/worktrees/agent-ad029fd316f7d3999/` worktree.

**Symptom:** every `vitest run` invocation (`pnpm test`, `pnpm --filter <pkg> test`, `pnpm exec vitest`, `npx vitest`) fails at STARTUP, before any test file loads:
```
TypeError [ERR_PACKAGE_IMPORT_NOT_DEFINED]: Package import specifier "#module-evaluator" is not defined
  imported from …\node_modules\.pnpm\vitest@4.1.8_...\node_modules\vitest\dist\chunks\cli-api.BfdDOPPI.js
```
The referenced `package.json` genuinely HAS a correct `imports` map for `#module-evaluator` (verified by reading it directly) — this is Node's own ESM package-boundary resolver failing to find it, not a broken install.

**Root cause (confirmed):** the resolved path length is 280 chars — over Windows' classic 260-char `MAX_PATH`. The `.claude/worktrees/agent-<40-hex-id>/platform/node_modules/.pnpm/vitest@4.1.8_<long-peer-hash>/node_modules/vitest/dist/chunks/…` chain is long enough on its own; the extra `.claude/worktrees/agent-<id>/` nesting (vs. a normal checkout) tips it over. Reproduced with plain `node` doing `import(pathToFileURL(thatExactFile).href)` directly — same error, confirming it's not vitest-CLI-specific.

**Ruled out (don't re-try these, confirmed ineffective):**
- `pnpm install --force` (full relink) — no change.
- `NODE_OPTIONS=--preserve-symlinks` — no change (the file isn't even a symlink; it's a hardlink/junction with matching realpath).
- `subst X: <worktree-root>` + running from `X:\platform` — no change; Node's resolver reports the ORIGINAL long path in the error even when invoked from the substituted drive (Windows transparently resolves subst back to the real path somewhere in Node's/MSYS's path handling).

**Verified NOT my-code-caused:** ran the identical failure against an UNMODIFIED pre-existing test file (`packages/styles/src/scrollbar.fitness.test.ts`) — same startup crash. This is a pre-existing, universal, environment-level block in this specific worktree location, not something a code fix resolves.

**Workaround used:** hand-replicate the exact parsing/assertion logic of the fitness test(s) in a plain throwaway `.mjs` script (no `#foo`-style self-referencing imports, so it's unaffected — plain `node script.mjs` works fine at any path length) and run it directly to get real pass/fail signal on the LOGIC, while being explicit in the final report that the actual vitest CLI gate is environmentally blocked. This is how the false-positive in [[css_fitness_comment_stripping_gotcha]] was actually caught — the manual replication surfaced it, not the (blocked) vitest run.

**For a future session:** if this worktree location is still this deep, expect the SAME block on any vitest-based gate step. `tsup`/`tsc`/`eslint`-based gates (build:engine, typecheck, lint) are unaffected — they don't hit this Node ESM self-import path. Fixing it for real would need Windows registry `LongPathsEnabled=1` PLUS an app manifest opt-in (Node.exe doesn't ship one by default) — out of scope for an agent to change.
