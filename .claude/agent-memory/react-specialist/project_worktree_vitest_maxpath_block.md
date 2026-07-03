---
name: worktree-vitest-maxpath-block
description: vitest CLI cannot start at all in .claude/worktrees/agent-<id>/platform on Windows — pnpm's vitest store path exceeds 260-char MAX_PATH; confirmed again 2026-07-03, unrelated to code changes
metadata:
  type: project
---

Re-confirmed 2026-07-03 in `.claude/worktrees/agent-a6d0f2c78946c5854/platform` while gating
AR-37 P0 (locale binding). Same root cause already logged by senior-frontend-developer in
[[windows_longpath_vitest_worktree_block]] (`.claude/agent-memory/senior-frontend-developer/`):
Node ESM's own package-imports resolver fails past Windows' 260-char `MAX_PATH` on the
`…/.claude/worktrees/agent-<40-hex>/platform/node_modules/.pnpm/vitest@4.1.8_<peer-hash>/node_modules/vitest/dist/chunks/…`
path (measured 280 chars here) — `ERR_PACKAGE_IMPORT_NOT_DEFINED` on `#module-evaluator`,
thrown before ANY test file loads.

**Confirmed environmental, not code-caused:** ran an UNMODIFIED pre-existing fitness test
(`localeString-render-guard.fitness.test.tsx`) — identical crash.

**Note:** this specific worktree had NO `node_modules` at all at session start (never
`pnpm install`ed) — that's a separate, fixable prerequisite (`pnpm install` at the `platform/`
root succeeds fine, ~35s). The MAX_PATH block only appears AFTER install, when vitest's own
CLI tries to resolve its internal `#module-evaluator` self-import.

**How to apply:** if a task needs a real vitest pass/fail signal in a worktree at this nesting
depth: (1) run `pnpm install` at `platform/` root first if `node_modules` is missing — don't
assume it's pre-installed; (2) once vitest itself is confirmed blocked (reproduce against an
unmodified file to rule out your own change), don't retry `--force`/`--preserve-symlinks`/`subst`
(all confirmed ineffective) — instead hand-replicate the new/changed logic in a plain throwaway
`.mjs` script (no `#foo`-self-import, unaffected by the block) for real signal on the LOGIC, and
say so explicitly in the report. `tsc -b`, `eslint`, and the bash `check-laws.sh` gate are all
UNAFFECTED (no vitest CLI involved) and should still be run for real green/red signal.
