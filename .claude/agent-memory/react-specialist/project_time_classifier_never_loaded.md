---
name: time-classifier-never-loaded
description: time dim has NO classifier members on the live stats path — year defaults via {$cl:'time'} resolve empty forever; latest-year must come from observations
metadata:
  type: project
---

On the live geostat/stats path the `time` dimension classifier is **never** populated in `store.classifiers['time']`, and never will be by any current path.

**Why (verified file:line):**
- `plugins/datasources/stats-registrations.ts:111-116` — the 'stats' store-builder fetches classifiers ONLY for `config.params.nonTimeDims`. The seed (`apps/api/scripts/seed-data-sources.ts:33-41`) sets `nonTimeDims: ['measure','geo'|'account','side'|...]` — `time` is deliberately excluded. Seed comment: "the store-builder derives classifiers from nonTimeDims today."
- Even if `time` were added to nonTimeDims, the API `/api/stats/classifiers/:dim` (`apps/api/src/routes/stats/classifiers.ts`) reads `stats.classifier` — which holds NO time members (time periods live in observations' `time_period`, not as codelist rows). The cube profile (`apps/api/src/routes/cube/index.ts:197-204`) reads members the same way → `membersByDim.get('time')` is `[]`.
- `ApiStore` does NOT implement `distinct` (caps.queryTypes = ['obs','val']) — no live distinct-time path either.

**Consequence:** a year-select default `{from:'options',pick:'last'}` whose `years` source is `{type:'inline', items:{$cl:'time'}}` (geostat GDP `year-bar`, provisioning ~line 1123) resolves `resolveYears` → `resolveRaw` → `resolveRef` against an absent classifier → `[]` ALWAYS. The latest year is unknowable from classifiers/profile; it is only derivable from the OBSERVATIONS.

**How to apply:** Any "gate year-default on classifier-not-yet-loaded then resolve" fix is UNIMPLEMENTABLE here — gating on `classifiers['time']` absence hangs the page in permanent loading. The vision-correct fix needs the latest-year to come from a store-backed time query (obs/distinct) OR the store/cube to expose a time-range seam. This is a cross-layer (config + plugins store-builder + core resolver + render-readiness) design → architect (Opus) escalation. See [[async-render-warm-read]] for the store async-readiness seam that a correct fix should reuse.
