---
name: dist-resolution-hygiene
description: Packages resolve to dist/ (not src) — a source change white-screens the live app until dist is rebuilt; tsc-green ≠ dist-fresh
metadata:
  type: project
---
**Fact:** `packages/*` export via `"exports"/"main" → ./dist/index.js` (built artifact), and `dist/` is git-IGNORED (untracked; deploy rebuilds from source). So the LOCAL running/preview app + Playwright e2e boot from `dist`, NOT from source.

**Why it bit (2026-07-11):** AR-50 M5 added `parseFormula` to `packages/expr/src` but did not rebuild `packages/expr/dist`. The live app then **white-screened at boot** (missing export) and every e2e failed at boot — while `tsc -b --force` was exit 0 (types check source, not dist freshness). Caught by the M5b agent's observation duty, not by my typecheck. Deploy was never at risk (untracked dist builds from source); only local/preview/e2e.

**How to apply:** after ANY `packages/*` SOURCE change, before trusting a LIVE check or e2e, run `pnpm -r --filter "./packages/*..." run build` to refresh dist — `tsc -b` green does NOT prove the live boot works (the app runs dist). This is a distinct vector of [[panel-live-boot-verification]] (unit/tsc-green ≠ live). Best-fix (register, not yet built): give packages a `"development"` conditional export → src so local dev/e2e resolve to SOURCE and never depend on dist freshness (closes the whole class); or a CI guard that fails when src is ahead of dist. Related: [[built-but-buried-audit]].
