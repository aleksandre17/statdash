---
id: "0016"
title: "C1: Formatting SSOT — compact formatter + yFormatter fix (Drift 1)"
status: done
class: M
priority: P0
owner: engine-specialist
implements: SPEC §1 C1, §4 FF-FORMAT-SSOT / FF-AXIS-MONOTONIC
depends_on: ["0009"]
links:
  - platform/work/SPEC-render-pipeline-target.md
  - platform/work/render-drift-audit.md
---
**Goal** — Every number (KPI · cell · axis tick · data-label · tooltip) funnels through the ONE formatter registry. Axis ticks stop lying and stop disagreeing with their own tables.

**Implements** — SPEC §1 C1 (fixes DRIFT 1). Invariant I-1 (Formatting SSOT).

**Root cause** — `packages/plugins/panels/chart/default/utils/apex/base.ts` `yFormatter`, when `decimals` is undefined and `|val| ≥ 1000`, does `fmtNum(val / 1000, 0) + ' 000'` — rounds to nearest 1000 and hard-codes the last 3 digits as literal "000". Lossy by construction (`88 425.6 → "88 000"`, `4 830 → "5 000"`, ticks `1500` & `2000` both → `"2 000"` — duplicate, non-monotonic). It bypasses the `LocaleFormatter`/`fmtNum` SSOT and disagrees with the table (which prints `88 425.6`).

**Files / modules touched**
- `packages/core/src/data/transform/formatters.ts` — add `compact` to `FORMATTERS`, backed by `Intl.NumberFormat(locale,{notation:'compact',maximumFractionDigits:1})`, resolved through the locale registry; deterministic under jsdom/SSR via builtin fallback.
- `packages/plugins/panels/chart/default/utils/apex/base.ts` — `yFormatter`: `decimals` given → `fmtNum(val,decimals)` (unchanged); `decimals` undefined → **`compact(val)`**, NOT `/1000+'000'`. Delete the `/1000 + ' 000'` branch.
- `responsiveYAxis` — already re-carries the formatter; keep. Data-labels (`cartesian.ts` end-labels) already pass `decimals ?? 1` → correct; leave them.

**Dependencies** — 0009 (O-1 axis-tick style: DEFAULT compact; the `ka` glyph confirm). Can build on the DEFAULT; only the `ka` abbreviation glyph is owner-only. No item depends on this being deferred — it is a prerequisite for trustworthy verification of E3/E4/E5/E6/E7 axes.

**Acceptance criteria (incl. fitness functions)**
- [x] `compact` formatter registered in `formatters.ts`, locale-resolved (Intl compact, en/ka), monotonic (1 significant fraction digit → equal ticks never collapse); deterministic manual fallback if Intl compact unavailable.
- [x] `yFormatter` else-branch routes through `compact`; the `+ ' 000'` string is gone. Locale threaded ApexRenderer(`useLocale`)→toApexOptions→builders→yFormatter.
- [x] **FF-FORMAT-SSOT**: only hand-rolled abbreviation in `packages/**` (`base.ts` `/1000+' 000'`) removed; axis ticks + compact cells resolve through the ONE registry (`compact`/`fmtNum`).
- [x] **FF-AXIS-MONOTONIC**: sample scale `[0,1500,2000,4830,88425.6,104598.1]` → distinct labels (`formatters.fitness.test.ts`).
- [x] Axis and table derive the same datum → agree in magnitude (`88.4K` vs table `88 425.6`; no fabricated `88 000`).
- [x] `pnpm -s typecheck` EXIT=0.

**Standing DoD (applies)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations, no bad blueprints; declarative/config-driven; conditional logics (visibleWhen/perspective/effects) covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — Wide blast radius, single-seam fix (Law 6 root-cause). Prerequisite for C4/C5/C6/E# axis verification. Two-way door.
