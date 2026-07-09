---
name: metric-ref-bind-target
description: AR-49/M0 governed metric-ref pattern — where a data-block's measure lives, how to add the enum-ref picker, and the kpi ITEM-SCHEMA gap
metadata:
  type: project
---

The GOVERNED metric picker (AR-49 / M0 build-item 10) is added to a data-block's
`meta.ts` PropSchema as an `enum-ref` field, NOT a new PropFieldType:
`{ field:<measure dot-path>, type:'enum-ref', source:'metrics', label:{...} }`.
Peer dimension picker = `source:'dimensions'`. Both tokens live on the open
`PropFieldSource` union (`packages/core/src/config/prop-schema.ts`), resolved by
the Inspector's EnumRefField from `describeApp().metrics/.dimensions`.

**Why / where the chart measure lives (non-obvious):**
- The chart PANEL carries NO own measure in its render path — it reads `ctx.rows`
  from its parent. BUT `NodeBase.data?: DataSpec` (react/engine/types/node.ts) means
  ANY node, incl. the chart, MAY carry its own DataSpec. The universal `query`
  DataSpec keeps its measure at **`data.query.measure`** (ObsQuery.measure). Confirmed
  against geostat.provisioning: charts/sections already hold metric-ids there
  (`gdp.current`, `regional.gva`, `accounts.*`). So the chart metric-ref field =
  `field:'data.query.measure'`. This is the exact dot-path the item-9 Metric-Palette
  bind writes to; resolveMeasureRef (AR-40) lowers id→code with NO new runtime path.
- Do NOT mark it `required`: a chart may INHERIT rows from its section (no own
  measure), and validateNodeConfig rule-3 errors on a missing required field.

**kpi-strip ITEM-SCHEMA gap (deferred, deliberately):** per-item measure is
`items[i].value.measure` inside an ARRAY. The spec's nested `itemSchema` affordance
DOES NOT EXIST — `PropField` has no `itemSchema` prop and no Inspector array
item-editor honors one (grep: zero hits in code). So no inline per-item picker; the
kpi metric-ref lands via the Metric-Palette bind. Adding itemSchema = a core
PropField widen + a panel array-item resolver (both outside plugins scope).

**Dimension-ref deferred on chart:** encoding channels name generic obs FIELD names
(label/value/series), and there is NO runtime "resolveDimensionRef" lowering seam
(unlike resolveMeasureRef for metrics). The only concrete slice path
(`data.query.filter.geo`) hardcodes a dim name (Law 1). So a chart dimension-ref has
no load-bearing target yet — defer until a lowering seam exists.

**Gate coupling:** a block-schema field flows into the generated
`packages/contracts/schema/page-config.schema.json` (enum-ref emits `{type:'string'}`
via propSchemaToJsonSchema `default`). Regenerate with `cd packages/react &&
pnpm run gen:schema` (ran clean on the MAIN checkout — the deep-worktree pitfall
does not apply here). Drift test = plugins `nodes/__tests__/page-config-schema.fitness`
(`expect(live).toEqual(committed)`). schema-completeness fitness also asserts every
enum-ref field declares a `source`. Note: as of M0 this metric-ref is the FIRST
enum-ref field in ANY plugin block schema.
