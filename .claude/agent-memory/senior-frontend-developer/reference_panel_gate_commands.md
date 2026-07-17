---
name: panel-gate-commands
description: Run panel gates (test/lint/tsc) from platform/ (the pnpm workspace root), not repo root or apps/panel
metadata:
  type: reference
---

The pnpm workspace root is `platform/` (not the repo root `national-accounts/`,
not `apps/panel`). Gate commands must run from there:

- `pnpm --filter ./apps/panel test`  (vitest run — ~90s, ~590 tests)
- `pnpm --filter ./apps/panel lint`  (eslint .)
- `pnpm exec tsc -b apps/panel`      (exit 0 = clean)

**Why:** running `pnpm --filter …` or `pnpm exec` from the repo root gives
`ERR_PNPM_RECURSIVE_EXEC_NO_PACKAGE` (no package found). The agent cwd defaults to
`apps/panel`, so `cd C:/.../national-accounts/platform && …` is required.

**How to apply:** parse the LOG for `Tests N failed` (=0) not just exit code. Two
pre-existing lint warnings are expected baseline (useLivePreviewStores.ts ref-cleanup,
DsdVersionPanel.tsx fast-refresh) — "no NEW errors" is the bar. Fitness source-scan
tests use `import.meta.glob([...], { query: '?raw', eager: true })` + a local
`stripComments()` so heading/label words in doc-comments don't trip the literal scan.

**Known pre-existing FAILURE (as of 2026-07-10):** ROOT `pnpm exec tsc -b` (the
whole graph) emits ONE error — `packages/plugins/nodes/__tests__/schema-completeness.fitness.test.ts:238`
TS2352 (`f as Record<string, unknown>` on a `PropField`), introduced by AR-49 M4
Wave 8 (commit a9dd088). Vitest (esbuild, no typecheck) passes it, so the test is
green at runtime. `tsc -b apps/panel` is CLEAN — the error is packages/plugins only.
Do NOT attribute this to a panel change; if you touch that file, fix the cast
(`as unknown as Record<string, unknown>`).
