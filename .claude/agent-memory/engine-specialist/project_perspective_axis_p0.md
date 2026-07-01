---
name: perspective-axis-p0
description: ADR + landed state for P0 of the perspective-axis refactor (contract envelope + core refinement + scope-key registry + registry alias + 2 FFs). What was added, where, and the byte-identical/additive proof.
metadata:
  type: project
---

# ADR — Perspective-axis refactor, PHASE P0 (landed 2026-06-27)

Foundational, one-way-door refactor: privileged `timeMode` weave → generic `perspective = f(state)` axis (an OLAP named query-view over the cube). Plan corpus: `platform/work/VISION-mode-as-perspective-axis.v3{,-PLAN,-FULLSTACK,-SYNTHESIS}.md`. **SYNTHESIS is the authoritative envelope** (it cut/re-shaped the v3.md/PLAN contract). P0 is purely ADDITIVE — no page declares `perspectives` yet; every legacy `mode`/`timeMode`/`by-mode` path is UNTOUCHED (retires P1–P6).

**Why:** the architect (Opus) needed P0 flawless + fitness-locked before P1+ build on it. The orchestrator converges + green-gates + commits P0+P-opt.

**How to apply:** when P1+ begins, this is the landed P0 seam. Don't re-derive; build on it.

## Decisions (the four SYNTHESIS refinements, locked at P0)
1. **`snapshot` is NOT a config field** (SYNTHESIS §1.1) — it is a render-call option (interactive=active, PDF=all). Absent from the contract. (P-opt threads it through the walker, not config.)
2. **`page.perspectives: Record<param, PerspectiveAxis>`** (SYNTHESIS §1.3) — one container shape for definition AND state. `PerspectiveAxis = { perspectives: PerspectiveDef[] }` has **NO `param` field** (the URL param IS the Record key); multi-axis (D-MULTIAXIS) = a 2nd key, never a plural rename. Mirrors `ctx.perspectiveState: Record<param, activeId>`.
3. **`scope` is a registry-keyed Record, not a closed interface** (SYNTHESIS §1.4) — every scope door = a `registerPerspectiveScopeKey()` call, never an interface widening (OCP). `timeBinding`+`metric` registered today; store/dims/blend deferred (facet RELOCATED to `PerspectiveAxis.render`, §3.2 — not a scope key).
4. **`perspectives[0]` IS the default** — NO `default?` field (LOW-1, one SSOT = array order).
5. **`available?` field present** (D-GUARD, SYNTHESIS §3.1) — availability guard, refined to VisibilityExpr; absent ⇒ always available. Not yet read (P1/P3+).

Rejected alternatives: (a) elevate a privileged `timeMode`/`mode` object — relocates the smells, not eliminates; (b) `view` naming — collides with the live `node.view`. `perspective` = OLAP-correct, collision-free.

## What landed (exact)
- **`packages/contracts/src/perspective-axis.ts`** (NEW, exported from contracts index) — structural envelope (zero-dep, shared by panel/api/core): `PerspectiveScope = Record<string, unknown>`; `PerspectiveDef = { id; label: ContractLocaleString; when?: JsonRecord; scope?: PerspectiveScope; available?: JsonRecord }`; `PerspectiveAxis = { perspectives: PerspectiveDef[] }`; `PerspectivesByParam = Record<string, PerspectiveAxis>`. NO snapshot, NO param-on-axis, NO default.
- **`packages/core/src/config/perspective-axis.ts`** (NEW, exported from engine index) — refines the opaque blobs: `PerspectiveScope = ContractPerspectiveScope & { timeBinding?: TimeDimensionSpec; metric?: string }` (an **intersection-with-the-contract-Record**, NOT an `interface` — an interface lacks an implicit index sig and would break the widen⇄refine invariant; this was the one non-obvious type trap). `when?`/`available?` → `VisibilityExpr`. Compile-time `_scopeWidens`/`_axisWidens` proofs lock assignability to the contract (the ManifestMode⇄ModeDef pattern).
- **`packages/core/src/config/perspective-scope-registry.ts`** (NEW) — pure-logic registry: `registerPerspectiveScopeKey`/`getPerspectiveScopeKeySchema`/`listPerspectiveScopeKeys`. **`packages/core/src/config/perspective-scope-schemas.ts`** (NEW) — the i18n authoring CATALOG (bilingual `{ka,en}` PropField labels for timeBinding+metric); registry/catalog split mirrors param-schema-registry⇄param-schemas. Registered via the core-index side-effect `import './config/perspective-scope-schemas'`.
- **`SectionContext.perspectiveState?: Record<string,string>`** added (core/context.ts) — the Harel orthogonal-regions slot. Additive optional; NOT read by anything yet (P1/P2 wire it).
- **`perspectiveRegistry`** = the canonical name (mode/registry.ts); `modeRegistry` kept as a back-compat alias of the SAME singleton (`perspectiveRegistry === modeRegistry`), retires P6. Both exported from engine index.
- **`@statdash/contracts` added to `packages/core/package.json` deps** (arrow-valid: contracts ← core; RESTRICT_ENGINE does not ban it).

## Fitness functions (non-vacuous)
- **`packages/core/src/config/perspective-axis.fitness.test.ts`** (NEW) — FF-PERSPECTIVE-ROUNDTRIP (a populated axis + the Record container survive JSON round-trip; perspectives[0]=default; every field survives), FF-VIEW-SCOPE-DECLARATIVE (no functions in the tree, Law 2), FF-SCOPE-KEYS-REGISTERED (registry non-empty; every scope key the sample uses resolves to a registered schema). Must `import './perspective-scope-schemas'` to fire the side-effect (importing the registry alone leaves it empty).
- **`apps/panel/.../coverage.fitness.test.ts`** — added the 5th coverage axis `PERSPECTIVE_SCOPE_KEYS`: enumerates `listPerspectiveScopeKeys()`, asserts each carries a schema OR is in `COVERAGE_TODO.perspectiveScope` (deferred keys are doc-only, not enumerated until they register). Satisfied by construction (§1.4).

## Gate state (all green, additive proven)
- typecheck (geostat app + panel) clean; lint 0 errors (43 pre-existing react-refresh warnings, untouched files); check-laws all clean; **full suite 1696 passed / 66 skipped / 0 failed** (1762 total).
- ADDITIVE proof: no existing type changed shape (every new field is optional/new); no resolver/render path reads the new types; `perspectiveState` absent ⇒ N=1-free identity (FF-ONE-VIEW-NO-MACHINERY precondition holds). modeRegistry behaviour byte-identical (same instance).
- **Allowlist twins updated** (Georgian `{ka,en}` catalog): `tests/no-tenant-content.fitness.test.ts` ALLOW set + `ops/scripts/check-laws.sh` LAW4_CATALOG_ALLOW regex — both gained `perspective-scope-schemas`. Keep the two in sync (gotcha: a new core catalog file MUST be added to BOTH or the no-tenant gate fails).

## Residuals closed (recorded in PLAN, see [[perspective-axis-residuals]])
- RESIDUAL 1: `ScopeOverride.compare` DEAD → DELETE in P6 (not now). RESIDUAL 2: `scope.metric` = measure-SWAP seam, NOT the point↔cagr carrier (that's node-local `value.type`). PLAN §"Residual the user must confirm" wording CORRECTED in `.v3-PLAN.md` (the line framing scope.metric as "the year/range measurement difference" was wrong).
