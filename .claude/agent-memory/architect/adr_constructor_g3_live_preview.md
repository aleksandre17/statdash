---
name: adr-constructor-g3-live-preview
description: ADR — Constructor G3 live-data preview; inject a live store map into CanvasView's NodePageRenderer via the SAME SiteProvider stores= seam the geostat runner uses (buildStoreManifest), keep empty-store as a toggle mode
metadata:
  type: project
---

# ADR — Constructor G3: live-data preview in the canvas

Status: PROPOSED (2026-06-24). Extends [[adr_constructor_phase2]] (closes its "Later/YAGNI — sampled-data preview" door). The Constructor is largely BUILT and green; G3 is the last open board gap.

Board paths were STALE (`engine/`, `@geostat/*`). VERIFIED layout: `platform/apps/{api,geostat,panel}`, `platform/packages/{contracts,expr,core,charts,react,plugins}`, scope `@statdash/*`. Engine = `@statdash/engine` (packages/core), React adapter = `@statdash/react` (+ `@statdash/react/engine`).

## The seam (verified)
- Runner (`apps/geostat/src/app/App.tsx`): `<SiteProvider stores={stores} …>` where `stores` = `buildStoreManifest(manifest.datasources)`. Each descriptor routed by `registerStoreBuilder('stats', …)` (`apps/geostat/src/data/stats-registrations.ts`) → `new ApiStore(base, datasetCode, nonTimeDims, classifiers, fromStatsObsRow, metadata)` wrapped in `CachedStore`. `buildStoreManifest` lives in `packages/react/src/engine/storeManifest.ts`.
- Panel canvas (`apps/panel/src/canvas/CanvasView.tsx`): `<SiteProvider stores={{ default: staticStore }}>` → `<NodePageRenderer page={…}>`. **Same prop, static map.**
- Store resolution (`packages/react/src/engine/resolveNodeRows.ts` `resolveStore`): `ctx.pageStoreKey ?? 'default'` → `stores[key]` → first store → `staticStore`. So swapping the `default` entry (or adding keyed entries) is the entire injection.
- G3 = replace the panel's static `stores` map with a LIVE one built through the SAME `buildStoreManifest` seam. Zero engine change. Law 3 holds: panel is the app shell that wires the store; renderer stays app-agnostic.

## Decision
- Build live stores in the panel via `buildStoreManifest(descriptors)` — but the `'stats'` builder currently lives in `apps/geostat` (Law 3: panel can't import another app). Promote `registerStoreBuilders` to a shared seam OR have the panel register its own builder. RECOMMENDED: extract the stats store-builder to `packages/plugins` (or a shared registration both apps boot), so panel + runner share ONE builder (SSOT, kills divergence). This is the real architectural move; the injection itself is trivial.
- Descriptors come from the session's DataSources (`pickActiveDatasetCode` already derives the cube; `datasetCodeOf` reads `config.datasetCode`). The panel already loads the cube-profile (`discovery/cubeProfile.store.ts`, `useActiveProfile`) — same dataset, same `/api/cube/:code/profile` discovery surface.
- Draft/unpublished edits preview fine: `ApiStore` reads OBSERVATIONS per-ObsQuery (Cache-Aside) keyed by the DataSpec the author is editing live — data is fetched against the live cube, structure comes from the in-memory draft page. No publish needed.

## Invariants
- `to/fromNodePageConfig` round-trip UNTOUCHED — G3 changes only the `stores` prop, not the page projection.
- Empty-store preview STAYS as a mode (a "structural | live" toggle). PRODUCT decision: default mode + live-by-default-vs-opt-in is a user call (interactive editor request volume).
- Fail-soft: profile absent / DataSpec unbound / API unreachable → fall back to `{ default: staticStore }` (the existing structural preview). The panel already has `mock-data.ts` + the cubeProfile 'error' state as graceful-degradation precedent. Never crash the editor.

## Phased (Strangler-Fig)
- G3.0: extract/share the stats store-builder so panel can call `buildStoreManifest`. Fitness: one builder, both apps register it.
- G3.1: live store injected behind a toggle, default = structural (additive, reversible). Fitness: toggle off ≡ today's bytes-identical static preview.
- G3.2: descriptors derived from session DataSources + debounce/cache for interactive edits. Fitness: N keystrokes ≤ M requests (CachedStore memo + specDimKey already gate this).

## Rejected
- Separate runner iframe against a published draft (already rejected in [[adr_constructor_phase2]] #4 — second runtime, needs publish, breaks draft-preview).
- Replace static store outright (loses the intentional structural-preview mode).
