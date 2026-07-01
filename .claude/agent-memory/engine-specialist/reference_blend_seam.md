---
name: blend-seam
description: blend transform op = declarative cross-store front-door for joinByField; B0 type+schema in core, B1 desugar in react resolveBlends (D3 / adr-data-blending-decision)
metadata:
  type: reference
---

`blend` is the DECLARATIVE, Constructor-authorable cross-store enrichment op that desugars to the existing `joinByField` hash-join (ADR adr-data-blending-decision, closes D3). Shape: `{ op:'blend', from:{ storeKey, query:ObsQuery, encoding? }, by, mode?, fields?, rename? }`. Pure data (Law 2), generic `by` dim (Law 1).

**B0 (core, additive):** `blend` member in `data/transform/types.ts` TransformStep union; `blendSchema` PropSchema in `data/transform/op-schemas.ts`; registered in `data/transform/index.ts` with an **identity no-op handler** + schema (so it is catalogued in `listTransformOps()` + surfaced via `getTransformStepSchema`, leaving COVERAGE_TODO). Core handler is a safe no-op: a blend that reaches the core pipeline un-desugared cannot reach a 2nd store (no manifest), so it passes rows through. NO real core impl — resolving the 2nd store needs the react manifest (Law 3).

**B1 (react, the gap-crossing):** `resolveBlends(transforms, ctx)` + `resolveStoreByKey(ctx, key)` in `react/.../resolveNodeRows.ts`. For each blend step: resolve `from.storeKey` against `ctx.stores` (the manifest lives ONLY in react), `interpretSpec({type:'query',query,encoding}, ctx.sectionCtx, secondaryStore)`, `projectSecondary` (narrow to `by`+`fields`, apply `rename`), rewrite → `{op:'joinByField', by, mode:mode??'left', source}`. Wired into `resolveNodeRows` right before `applyPipeline`. No-blend pipelines returned byte-identical (`.some(op==='blend')` fast-path → `return transforms`). `resolveStoreByKey` reuses the `_storeCache` WeakMap wrapping (shared CachedStore instance, no N+1) + async/streaming bypasses, mirroring `resolveStore` but EXPLICIT-key not cascade.

**B3 (authoring):** zero bespoke code — `blend` authored through the existing generic `TransformStepEditor` → `transformStepSchemaSource` → `getTransformStepSchema('blend')`. `from` uses the typed `object` sub-editor (same bounded escape as `lookup.from`/`join.with`/`filter.where`).

**B2 (grain reconciliation): DEFERRED** (YAGNI per ADR) — no consumer; seeded gdp/regional share `time` grain. Injection point if needed: a `reduce` step on secondaryRows right before `projectSecondary` in resolveBlends, gated behind FF-BLEND-GRAIN.

**Coverage reconciliation:** `joinByField` stays PERMANENT in COVERAGE_TODO (schema-less engine + programmer escape) but its allowlist comment now names `blend` as the declarative front-door. `blend` is NOT allowlisted (it carries a schema → surfaced).

**Fitness nets:** core `data/transform/blend.fitness.test.ts` (FF-BLEND-DECLARATIVE, FF-BLEND-ROUNDTRIP, FF-BLEND-KEY-GENERIC, authorable+no-op); react `engine/blend.fitness.test.ts` (FF-BLEND-ROUTES-SECOND-STORE, FF-BLEND-DESUGARS-TO-JOIN row-identical to hand-built join, FF-BLEND-KEY-GENERIC geo). Test store pattern: spread `staticStore` + override `querySync({type:'obs'})` returning canned obs by measure (non-static ⇒ CachedStore-wrapped, real path).

Related: [[metric-store-binding]] (the storeKey manifest tier), [[transform-dispatch-registry]] (the op registry blend joins), [[desugar-seam]] (core desugar — blend desugars in REACT not core, deliberately, because the manifest is react-only).
