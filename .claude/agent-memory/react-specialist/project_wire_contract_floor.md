---
name: wire-contract-floor
description: STEP B react-tier of the wire-contract floor — generatePageConfigSchema, the emitted page-config.schema.json artifact, registerNodeType injection, and the F4 structural-mirror index-signature gotcha
metadata:
  type: project
---

Wire-contract floor (ADR adr-config-and-render-vision §7) STEP B, react-tier — landed.

**registerNodeType injection:** the SINGLE node-registration loop is `nodeRegistry.register(...)` inside `registerSlice()` (packages/react/src/engine/registerSlice.ts), NOT register-all.ts (which only constructs the singleton). One line `registerNodeType(m.type)` (imported from `@statdash/engine`) sits right after that register call, inside the `'node'|'page'|'panel'` branch.

**generatePageConfigSchema** (packages/react/src/engine/generatePageConfigSchema.ts): composes describeApp() → Draft-2020-12 doc. Per-node `$defs` reuse `propSchemaToSubSchema` (a new `$schema`-less sibling of propSchemaToJsonSchema — NOT a fork; both share buildProperty). KEY: the document schema is STRUCTURAL FLOOR only — it must drop PropSchema-`required` (e.g. section's authored `title`); only `type` (+ page-root id/children) is required, else real configs fail ajv `oneOf`. Each branch pins `type` to a const + `additionalProperties:true`, so a typed node matches exactly one oneOf branch. children → `$defs/AnyNode` (shared union); document root oneOf = the 3 page roots only.

**Emit script** packages/react/scripts/emit-page-config-schema.ts (`pnpm gen:schema` → root + react script via tsx). Writes packages/contracts/schema/page-config.schema.json (generated DATA, not code). CONSTRAINT: react→plugins violates the arrow; the script lives under a SCOPED eslint override for `packages/react/scripts/**` (build tooling, never shipped — react `files:["dist"]`). It imports plugin meta.ts + projector files via RELATIVE disk paths (`../../plugins/...`) because (a) plugins exports-map blocks deep subpaths and (b) the catalog/presentation BARRELS pull `.css` which plain tsx cannot load. meta.ts + projector files are `import type`-only on react → CSS-free under tsx.

**F4 gotcha (real drift caught):** engine's `StructuralNode` (validation/config.ts) originally had `[k:string]:unknown`. That index signature BREAKS the strict-widening guarantee — plain interfaces without their own index signature (BarNode, FilterBarNode) are NOT assignable to a type that declares one. Removed it (the validator reads structural keys via explicit casts, never the index sig). F4 test (packages/react/src/engine/structuralMirror.fitness.test.ts) pins `NodePageConfig extends StructuralPageConfig` at compile time via `[A] extends [B] ? true : false` forced to `true` — fails typecheck on drift.

See [[registry-over-special-case]].
