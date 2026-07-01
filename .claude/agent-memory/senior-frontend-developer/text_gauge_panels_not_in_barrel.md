---
name: text-gauge-panels-not-in-barrel
description: text + gauge panels exist on disk but are NOT exported from packages/plugins/panels/index.ts, so they never register and silently render nothing
metadata:
  type: project
---

The `text` and `gauge` panels exist on disk under `packages/plugins/panels/{text,gauge}/default/` (full shells + meta) but are NOT exported from the panels barrel `packages/plugins/panels/index.ts` — which only exports `chart`, `table`, `kpiStrip`, `map`.

**Why it matters:** setupRegistrations registers panels by iterating the barrel (`Object.values(Panels)`). Because text/gauge aren't in the barrel they are never registered, so `nodeRegistry.get('text')` / `get('gauge')` return undefined. renderNode step 4 returns null for an unregistered type → the node SILENTLY renders nothing (no error, no warning beyond the slot-placement notice). A page authored with a top-level `text`/`gauge` node just shows empty.

**How to apply:**
- Do NOT use `text` or `gauge` as renderable nodes in geostat fixtures/configs/tests until they're added to the barrel — they won't render.
- Renderable content panels today: `chart`, `table`, `kpi-strip`, `map`. Renderable structural nodes: `section`, `page-header`, `filter-bar`, layout nodes, etc. A `section`'s own `title` IS rendered tenant content (data-free render target — good for DB-independent render tests).
- The emptyManifest() offline page in `apps/geostat/src/data/site-manifest.ts` builds an `inner-page` whose only child is a `text` node — by the same gap that fallback page likely renders an EMPTY body (worth verifying / flagging; offline copy may not show). Out of frontend lane to fix the barrel (packages/**), but flag to the architect: either export text/gauge or change the offline page to a registered node.
- Fixing the barrel is a one-line add in packages/plugins/panels/index.ts but that package is owned by the engine/plugins lane.
