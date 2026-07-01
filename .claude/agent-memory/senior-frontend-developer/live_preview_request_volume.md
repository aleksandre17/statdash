---
name: live-preview-request-volume
description: How the apps/panel live-preview editing loop bounds cube request volume — async-store cache topology + the G3.2 page-descriptor debounce seam
metadata:
  type: project
---

The Constructor canvas live-preview (apps/panel `CanvasView`) bounds cube observation requests during DataSpec editing through THREE composed layers — know the topology before adding any caching here.

**Why:** the live store is `ApiStore` (`caps.sync === false`). In `resolveStore` (packages/react/src/engine/resolveNodeRows.ts) async-only stores BYPASS `CachedStore` (`if (raw.caps?.sync === false) return raw`). So for live preview the dedupe is NOT CachedStore — it is:
- `ApiStore._cache` (keyed `JSON(params)`) — dedupes identical observation requests.
- `useNodeRows._promiseCache` (module-level Map, keyed `specDimKey`, cap 200) — dedupes the suspending promise per data-dependency fingerprint.
These caches dedupe IDENTICAL queries but CANNOT collapse the DISTINCT intermediate DataSpec states a keystroke burst produces — each distinct spec = distinct specDimKey = distinct fetch.

**How to apply:** the only thing that bounds VOLUME across an edit burst is debouncing the page descriptor feeding the live renderer. That seam is `useDebouncedLivePage(page, mode)` (G3.2): structural mode = identity passthrough (byte-identical/instant); live mode publishes only the settled page after `LIVE_PREVIEW_DEBOUNCE_MS` (350ms, single named constant). It feeds the renderer's Layer 1 ONLY; the overlay (Layer 2, selection/drop) keeps the live `page` so editing stays responsive. The live-store MAP (`buildStoreManifest` in `useLivePreviewStores`) keys off the cube binding (descriptors), NOT the page — so a DataSpec edit never rebuilds it. Do not add another cache layer here; debounce the descriptor, lean on the two existing query-identity caches.

**Lint gotcha:** the panel eslint config forbids reading/writing refs during render AND setState-in-effect. The previous-value tracker in `useDebouncedLivePage` is held as STATE (set-state-during-render idiom), not a ref; the synchronous structural/toggle publish happens in render-phase, not an effect.
