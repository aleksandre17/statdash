# Implementation Roadmap — statdash-platform

> Standard: **Senior Application, Architecture & Design Engineer** — Readable · Clear · Organized · Growth-oriented · SOLID · Patterns · Agnostic · DRY
>
> Source: architectural audit (2026-06-02, Opus) — 34 gaps, file:line, root-cause clusters.
> Each layer: independently deployable · `tsc 0` · `JSON.parse(JSON.stringify(config)) === config` · no silent failure.

## Operating Rules (binding for every layer)

1. **TSC clean.** `npx tsc --noEmit` = **0 errors** at close of every layer.
2. **Serialization invariant.** Every `NodeDef` / `FilterSchema` touched: `JSON.parse(JSON.stringify(config))` deep-equals `config`. No functions, JSX, or class instances in config.
3. **Engine purity.** `engine/core` = zero React, zero `import.meta`, zero app-specific content, zero hardcoded locale strings.
4. **Registry is SSOT.** No `Set`, union, or array that mirrors a registry. Type unions derive from the registry.
5. **One concern, one home.** Logic in two places is a bug. One shared unit, thin boundary wrappers.
6. **No silent failure.** No path returns `[]`/`null`/placeholder for misconfiguration without a typed diagnostic.
7. **Constructor-readiness.** Every config type round-trips through JSON and reconstructs identically.
8. **No L-sized layers.** Max effort per layer = M (half-day). Split at M before starting.
9. **Independently deployable.** After every layer: app boots, `tsc` passes, tests pass.
10. **Two Hats.** Structure-only OR behavior-only per commit. Never both.

## Root Causes

| Root | Summary | Eliminated by |
|------|---------|---------------|
| **A** — Open registry, closed mirrors | `ChartType` union + `KNOWN_*` Sets drift from registries | Phase 0 |
| **B** — Datasources not first-class JSON | No `SiteManifest.datasources`; classifiers at module-load | Phase 3 + 7.1 |
| **C** — Validation disconnected from live tree | Validates dead `SectionDef`, not the live `NodeDef` tree | Phase 0.4 + 5.3 |
| **D** — Duplicated seams | `evalVarMap` vs inline loop; `EngineRow` vs `RawRow` | Phase 2 |

## Phase Index

| Phase | File | Status | Focus |
|-------|------|--------|-------|
| 0 + 0.5 | [roadmap-phase-0.md](roadmap-phase-0.md) | ✅ COMPLETE | Integrity + conformance guards |
| 1 + 2   | [roadmap-phase-1-2.md](roadmap-phase-1-2.md) | ✅ COMPLETE | Engine purity + loose coupling |
| 3 + 4   | [roadmap-phase-3-4.md](roadmap-phase-3-4.md) | ⬜ pending | JSON datasources + type tightening |
| 5 + 6   | [roadmap-phase-5-6.md](roadmap-phase-5-6.md) | ⬜ pending | Pipeline robustness + readability |
| 7 + 8   | [roadmap-phase-7-8.md](roadmap-phase-7-8.md) | ⬜ pending | Platform power + arch moves |
| 9 + 10  | [roadmap-phase-9-10.md](roadmap-phase-9-10.md) | ⬜ pending | Standard-setting + north star |
| coverage | [roadmap-coverage.md](roadmap-coverage.md) | — | All 34 gaps + N1–N33 assigned |

## Execution Arc

```
TIER 1  (best-in-class engineering)
  Phase 0   Integrity          ✅ 0.1→0.2→0.3→0.4→0.5
  Phase 0.5 Conformance guards ✅ 0.6→0.7
  Phase 1   Engine purity      ✅ 1.1→1.2
  Phase 2   Loose coupling     ⬜ 2.1→2.2→2.3
  Phase 3   Phase-2 ready      ⬜ 3.1→3.2→3.3→3.4
  Phase 4   Type tightening    ⬜ 4.1→4.2→4.3→4.4→4.5
  Phase 5   Pipeline robust    ⬜ 5.1→5.2→5.3
  Phase 6   Readability        ⬜ 6.1→6.2→6.3→6.4
  Phase 7   Platform power     ⬜ 7.1→7.2
  Phase 8   Arch moves         ⬜ 8.1→8.2→8.3→8.4
        ▼ gate: tsc 0, all tests, app boots
TIER 2  (standard-setting — official statistics grade)
  Phase 9   Spine              ⬜ 9.1→9.2→9.3→9.4→9.5 then 9.6–9.14
        ▼ gate: spine holds
TIER 3  (category-defining)
  Phase 10  North star         ⬜ 10.1→10.2 then 10.3–10.6 (evidence-gated)
```

**Next layer:** 2.1 — Unify `EngineRow` and `RawRow` into one canonical row type. See [roadmap-phase-1-2.md](roadmap-phase-1-2.md).
