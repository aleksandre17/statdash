---
name: time-dim-ssot
description: TIME_DIM + atTime() in core/context.ts is the SSOT for the conventional time-axis dim key; all consumers import it, no raw 'time' literals
metadata:
  type: reference
---

`platform/packages/core/src/core/context.ts` exports `TIME_DIM = 'time'` and
`atTime(t, ctx)` as the single named home for the conventional SDMX TIME_PERIOD
dim key. This is NOT a privileged dimension — it is the one named SSOT replacing
scattered magic `'time'` literals (the engine still treats all dims generically;
`ctx.dims[TIME_DIM]`).

Consumers that import and MUST keep using these (no local `'time'` literal, no
private `atTime` copy): `registry/resolvers.ts`, `data/kpi.ts`, `data/spec.ts`
(extractRequirements), `data/store-api.ts` (from/to bounds + filter skip),
`data/fieldSchema.ts` (timeseries/growth schema field name).

**How to apply:** when adding a time-axis resolver or reading the year/period
key, import `{ atTime, TIME_DIM }` from `../core/context` — never reintroduce a
raw `'time'` literal or a duplicate `atTime`. A grep for `['time']` in non-test
core should only hit comments/config-string examples (`$ctx: 'time'` is user
config data, not a hardcode). Related: [[transform-dispatch-registry]].
