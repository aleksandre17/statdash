# Anti-Pattern Hunt & Self-Policing Gate Rollout

> **Date:** 2026-07-10. **Author:** chief-engineer (read-only sweep), triaged by the orchestrator.
> **Purpose (owner mandate):** the owner must NEVER be the mechanism that discovers hardcodes / privileged blueprints / anti-patterns / unenforced laws. This is the standing ledger + the plan to make each class MACHINE-CAUGHT (build-time gate) so recurrence is impossible and discovery leaves the owner's eyes.

## Headline
The codebase is already highly self-policed (~175 `*.fitness.test.*`, a real dependency-arrow gate via eslint `no-restricted-imports`, a manifest law-pattern hook). The owner's three cited culprits — `PAGE_ROOT_TYPE`, palette taxonomy, `FF-CHROME-TOKEN-DRIVEN` — are already fixed and are now the reference pattern. **The leverage is in the classes still WITHOUT a gate (below).** Plus one foundation issue the sweep under-weighted: the canvas page adapter still hardcodes `type:'inner-page'` and drops each page's real type on load (per-page-type foundation fix — tracked in the chrome/foundation pass).

## Findings (verified)
### A — High severity (breaks-correctness / silent-fail)
- **A1 — Config write boundary does not enforce Law 2.** `apps/api/src/routes/config/pages.ts:261` PUT runs `guardConfig` in WARN mode → invalid page tree still persists (no 400). `nextDataSpecs` (`:255,265`) + standalone DataSpec PUT (`data-specs.ts:60-90`) persist with ZERO Law-2 declarative validation. The persistence boundary — the last defense-in-depth — accepts anything. (= BUG-B + more.)
- **A2 — Dead inspector group refs.** `ChartGroups` (`chart/default/ChartNode.ts:103`) names `fields:['view.legend','view.tooltip']` that don't exist in `ChartSchema` → group renders empty silently. `TableGroups` `cols`(typo→columns)/`footer` same class. Nothing checks a `PropertyGroup.fields[]` path resolves.

### B — Architectural debt
- **B1 — Orphaned `apps/panel/src/canvas/page-step.css`** (deleted-wizard residue; no importer).
- **B2 — Law 1 privileged-literal gate scoped to ONE dir** (`packages/core/src/registry/**` only). `core/config`, `core/data`, `charts`, `plugins`, `apps/panel` are ungated for bare `{time:…}` keys / `=== 'time'`.

### C — Laws stated but not (fully) machine-enforced
| Law | Status |
|---|---|
| L1 no privileged dims | PARTIAL (literal scan one-directory — B2) |
| L2 declarative config | PARTIAL (AST hole for `val()/if/switch` in DataSpec literals + write-boundary hole A1) |
| L3 dependency arrow | ✅ FULLY GUARDED (eslint no-restricted-imports) |
| L5 `fromSDMX` = only adapter | UNGUARDED (class-M reminder only) |
| L8 platform/OCP | reasonably guarded |
| L9 a11y + integrity | reasonably guarded |
| PropertyGroup→schema integrity | NO GATE (A2) |
- Coverage-drift: `FF-CHROME-TOKEN-DRIVEN` scans an explicit 5-file glob, not the chrome directory → a new chrome file escapes the brand scan.

## Self-policing gate rollout (top 10, by leverage)
1. **FF-GROUP-FIELDS-RESOLVE** — every `PropertyGroup.fields[]` path exists in the node's PropSchema. *(A2 + whole class.)*
2. **FF-WRITE-BOUNDARY-VALIDATES** — config + DataSpec PUT validate before persist (or make WARN-vs-reject explicit; the DataSpec path has zero guard even in WARN). *(A1.)*
3. **eslint DataSpec-scoped no-`val()`/`if`/`switch` AST rule** — closes the Law-2 hole the manifest names.
4. **Widen FF-NO-PRIVILEGED-LITERAL** to core/config, core/data, charts. *(B2.)*
5. **FF-NO-ORPHAN-CSS** — every `src/**/*.css` imported somewhere. *(B1 + class.)*
6. **FF-SINGLE-ADAPTER** — only `fromSDMX` converts API → `DataRow[]` (Law 5).
7. **Harden FF-CHROME-TOKEN-DRIVEN** — 5-file list → chrome-directory scan.
8. **FF-SLICE-DECLARES-CATEGORY** — every non-root slice declares `meta.category` (silent-degrade→red).
9. **FF-GATE-BITES** — meta-test: every `*.fitness.test.*` carries a proven-negative ("planted violation is caught"), so a false-green (like the Wave-8 root-tsc slip, fixed in `e6852a4`) cannot ship. *The gate that guards the gates.*
10. **FF-LAW-COVERAGE-LEDGER** — machine-readable Law→gate map, tested for completeness; a new law without a gate fails CI.

**Top 3 by blast radius:** #1 (dead-ref class), #2 (data-integrity boundary), #9 (protects the whole gate investment from silent rot).

## Rollout status (orchestrator-tracked)
- **Batch 1 (building):** #1 FF-GROUP-FIELDS-RESOLVE, #5 FF-NO-ORPHAN-CSS, #7 harden chrome scan, #8 FF-SLICE-DECLARES-CATEGORY — plus fixing the rot they turn red (A2 dead-refs, B1 orphan CSS).
- **Batch 2 (queued):** #2/#3 write-boundary + DataSpec Law-2 (api), #4 widen privileged-literal, #6 FF-SINGLE-ADAPTER.
- **Batch 3 (queued):** #9 FF-GATE-BITES (meta-gate — needs careful design), #10 law-coverage ledger.
- **Foundation code (queued, before feature-waves resume):** per-page-type canvas adapter (Law 1 / chrome-fidelity root), chrome canvas fidelity+select+surface, insert accept-graph content-block gap.
