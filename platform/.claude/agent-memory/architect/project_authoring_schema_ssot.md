---
name: project-authoring-schema-ssot
description: Authoring-SSOT epic (engine manifest/PropSchema as the ONE authoring vocabulary) — P1 SHIPPED (config-semantics SSOT); P2/P3/P4 remain, fan out in parallel
metadata:
  type: project
---

Epic: the Constructor (`apps/panel`) must CONSUME the engine's declared schema +
capability manifest, never fork/hand-sync it. Design doc (the plan SSOT):
`platform/work/DESIGN-authoring-schema-ssot.md`. Strangler-Fig, each phase green + FF-locked.

**P1 SHIPPED (2026-07-01, commit `c1a635e`).** The config-semantics SSOT is extracted and
all forks retired:
- NEW `packages/core/src/config/prop-path.ts` = `getAtPath`/`setAtPath` (one dot-path
  grammar, read=write parity, numeric segment = array index).
- NEW `packages/core/src/config/prop-visibility.ts` = `evalShowWhen` (the one `lhs === rhs`
  showWhen parser; name is `evalShowWhen` NOT `isVisible` — `isVisible` is already taken in
  `config/filter` by the VisibilityExpr evaluator).
- Both re-exported through `@statdash/react/engine` → zero consumer import-path change.
- Retired 4 forked bodies: `PropSchemaForm.tsx` (DEMOTED to headless reference fallback,
  header marked-for-retirement, deliberately NOT the panel's surface = Law-3-correct),
  `validateNodeConfig.ts`, `apps/panel/inspector/showWhen.ts` (now a thin re-export keeping
  local `isVisible` alias + `./showWhen` path for Inspector + 7 setAtPath editors),
  `apps/panel/save/saveGuard.ts` (divergent `getAt` reduce reader → shared `getAtPath`).
- FF-NO-FORKED-ISVISIBLE = `packages/core/src/config/no-forked-isvisible.fitness.test.ts`
  (grep scan core+react+panel: exactly 1 showWhen parser, 1 `getAtPath`/`setAtPath` decl, 0
  `getAt`). The "latent array-index bug" was benign at runtime (all 4 readers reached arrays
  via JS bracket access) — the real fix is killing the divergent copy so parity is provable
  from ONE source.

**Why:** DRY/SSOT — two byte-identical showWhen evaluators + four dot-path readers meant the
runner and the Constructor could interpret field visibility / a config path differently (a
correctness bug, not a style nit).

**How to apply:** P1 was the ONLY hard prerequisite; P2/P3/P4 now fan out in PARALLEL on the
shared helpers — do NOT re-serialize them behind each other.
- **P2** — `saveGuard` 5th check `capability-registered` (fail-early: block a page that emits
  an unregistered `node.type`/`chartType`/`specType`). FF-SAVEGUARD-DESCRIBES.
- **P3** — chart `fieldConfig.colorMode` + `fieldConfig.thresholds` into `ChartSchema` (lift
  the gauge's raw-JSON threshold control unchanged). DEFER `overrides` (door
  D-FIELD-OVERRIDE-MATRIX). FF-CHART-FIELDCONFIG-AUTHORABLE.
- **P4** — expose `ChartNode.dataLinks` as `type:'array'` schema field (JSON fallback). Rich
  builder deferred (door D-DATALINK-BUILDER; `filterParams`/`pages` enum-ref sources already
  exist). FF-DATALINKS-AUTHORABLE.

Related: [[adr_constructor_phase2]] · [[adr_element_config_schema_seam]] (per-slice schema
seam this rides on).
