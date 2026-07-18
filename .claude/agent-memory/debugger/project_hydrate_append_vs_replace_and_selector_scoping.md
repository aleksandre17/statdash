---
name: hydrate-append-vs-replace-and-selector-scoping
description: Two durable diagnostic patterns from the W2 dev-panel probe walk (0072-w2) — boot-hydrate append-duplicate races that fake a "data collision" symptom, and ambiguous DOM selectors that silently target the wrong element between an insertion palette and a live canvas overlay.
metadata:
  type: project
---

## Pattern 1 — count the ACTUAL duplicate key values before trusting a plausible data-collision hypothesis
A lead/brief hypothesis said 12 React "same key" duplicate-key warnings ≈ the region count, from
many canvas items now sharing one governed metric-id after a raw-code→metric-id migration. The
KEYS in the actual warnings were UUIDs, not the metric-id string — that one fact falsified the
hypothesis immediately. Always read the literal duplicated key value out of the console warning
(patch a probe to print `m.text()` in full, don't trust a truncated/sliced log) and match it
against a live `/api/...` payload before accepting a plausible-sounding cause.

The real defect: `initFromApi()` (`apps/panel/src/store/api-actions.ts`) hydrates `dataSources`/
`dataSpecs` via `sources.forEach(r => store.addDataSource(...))` — a blind APPEND. App.tsx's boot
guard (`if (store.dataSources.length > 0) return`) is a SYNCHRONOUS check racing the ASYNC
`initFromApi`, so under React StrictMode double-invoke (or an HMR re-mount) both invocations can
pass the guard before either writes — `initFromApi` runs twice, and the append duplicates every
source/spec id. **The exact same defect class had already been fixed for `pages`** (hydrate via
`setPages`, an authoritative REPLACE — see `constructor.pages.ts` `setPagesPatch` + its dedicated
`initFromApi.test.ts` "hydrate idempotency" suite) but the fix was never generalized to the
sibling `dataSources`/`dataSpecs` collections. **Lesson: when one collection in a boot-hydrate
path has an idempotency guard/test and sibling collections in the SAME function don't, suspect
the sibling collections carry the identical latent defect — grep for `.forEach(store.add*)` next
to a `.forEach(store.set*)` in the same hydrate function.**

Diagnosis recipe that found it fast: intercept `page.on('response')` for the suspect list
endpoints (`/api/config/data-sources`, `/api/config/data-specs`) and diff the returned row ids
against the duplicated warning keys — an exact match confirms which store collection is
double-appending, no source reading needed to CONFIRM (though source reading is still needed to
find the root cause in the hydrate function).

## Pattern 2 — an "insert new element" palette and a "select existing element" canvas overlay can share the SAME data-attribute value for different meanings
A Playwright probe's canvas-element selector `[data-node-type="chart"], .canvas-node` silently
matched the WRONG element: the left-rail insertion `NodePalette` stamps `data-node-type="chart"`
on its OWN tile button (`aria-label="Add: chart"`) meaning "insert a new chart block" — a totally
different affordance than the live `CanvasOverlay`'s selectable focus-frame buttons, which ALSO
carry `data-node-type="chart"` (plus `data-node-id` and the `.canvas-node` class) meaning "this
EXISTING canvas element is of type chart". The palette tile sits earlier in DOM order, so
`.first()` grabbed it, the click was a no-op for selection, and every downstream assertion
(Inspector DATA facet, MetricPalette) legitimately found nothing — not because the product path
was broken, but because nothing was ever selected.

**Lesson: when a probe selector combines a generic type-attribute with a generic class
(`[data-X], .Y`) and the walked journey silently no-ops, suspect the same attribute is reused
with a DIFFERENT semantic by an unrelated sibling UI region (insertion palette vs. live canvas,
template picker vs. instance list, etc.) that happens to render earlier in the DOM. Fix by
SCOPING to the real container (`[data-testid="canvas-overlay"] .canvas-node[data-node-type=
"chart"]`), never by making the selector more specific in isolation — isolation doesn't fix DOM
order collisions.** Confirm the real path works end-to-end (not just "element found") by reading
back a positive-confirmation signal the component itself emits — here, `MetricPalette`'s
`aria-live="polite"` status region text (`"მეტრიკა მიბმულია: <label>"`) after the bind click,
not just a truthy element count.

See also [[probe-methodology-hard-vs-soft]] for the sibling class of probe-vs-product
misdiagnosis (soft-nav vs hard-nav) on this same project.
