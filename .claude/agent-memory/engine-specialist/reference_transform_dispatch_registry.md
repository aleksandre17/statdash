---
name: transform-dispatch-registry
description: applyStep dispatches transform ops ONLY through the step-registry (getTransformStep), no switch; registration via transform/index.ts side-effect
metadata:
  type: reference
---

`platform/packages/core/src/data/transform/pipeline.ts` `applyStep` dispatches
ONE way: `getTransformStep(step.op)` from `step-registry.ts`. There is NO closed
switch anymore (it previously had a parallel switch missing reduce/window/
joinByField — an OCP gap; the registry was the SSOT but applyStep ignored it).
Unknown op → rows unchanged (no throw).

Built-in ops register at module init in `transform/index.ts` via
`registerTransformStep(...)` (18 ops). The barrel `data/transform.ts` re-exports
`./transform/index`, so any caller importing from `'../transform'` triggers
registration. Load order is safe: `index.ts` imports `pipeline.ts` before the
register calls, but `applyStep` is only *called* at runtime (post-registration).

**How to apply:** to add a transform op, write `applyX` in `steps.ts` (or
`ops/`) and add ONE `registerTransformStep('x', applyX)` line in
`transform/index.ts`. Do NOT add a case to any switch — none exists. Plugins
extend the same way via the public `registerTransformStep`. A direct
`import from './pipeline'` without also importing `./index` leaves the registry
empty (only `registry.test.ts` does this, and it imports `./index` for side
effects). Related: [[time-dim-ssot]].
