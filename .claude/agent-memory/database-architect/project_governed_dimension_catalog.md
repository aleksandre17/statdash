---
name: governed-dimension-catalog
description: AR-49 M0 item 6 — governed dimensions[] + expanded metrics[] seeded in geostat provisioning; the measure-exclusion peer split, conceptRole source, and the bootstrap projection gap I closed
metadata:
  type: project
---

AR-49 M0 build-item 6 landed: the governed **dimension catalog** + extended metric catalog in `platform/apps/api/provisioning/geostat.provisioning.json`, delivered as a new `siteConfig` key `dimensions` (the peer of the existing `metrics` key). 6 governed dimensions seeded (`time`, `geo`, `approach`, `account`, `side`, `sector`); metrics grew 13→17 (+`gdp.finalConsumption`/`capitalFormation`/`exports`/`imports` — the C+I+X−M expenditure identity components, all under `dataSource:gdp`, `dims:{geo:GE,approach:EXP}`).

**Why (decisions worth keeping):**
- **`measure` is deliberately NOT a governed dimension.** The peer split partitions the DSD: the measure axis is governed by `MetricDef` (metrics ARE the governed measures), every OTHER dim by `DimensionDef`. A governed `measure` dimension would double-govern the same axis and re-expose the raw measure codes metrics exist to replace.
- **conceptRole values are sourced from the DB SDMX role vocabulary** (`V30__seed_concept_role.sql`, CHECK vocab = `measure|attribute|time|geo|classification`): measure→measure, time→time, geo→geo, and approach/account/side/sector→`classification`. conceptRole is an OPEN advisory string (Law 1) — the engine never branches on it.
- **Members are NEVER copied** (Law 5): every DimensionDef omits `members` (⇒ all-from-DSD). Only `defaultMember` pins a single confirmed-real code (`geo:GE`, `approach:_Z`) — verified real by page usage + config-cube-contract CHECK 3. No whitelists seeded (kept strictly Law-5-safe; whitelist is a later curation lever).

**How to apply:**
- The api bootstrap route (`apps/api/src/routes/bootstrap/index.ts`) previously projected only `metrics` from siteConfig; it did NOT read `dimensions`. I added the `dimensions` SITE_KEY + verbatim projection (exact peer of `metrics`) — without it the seeded data never reaches the runner's `registerManifestDimensions` (already wired in `apps/geostat/src/data/site-manifest.ts`). If touching bootstrap delivery, both keys move together.
- `geostat-provisioning.fitness.test.ts` asserts the EXACT siteConfig key set via `toEqual` — now 7 keys (added `dimensions`). Any new siteConfig key must update that assertion or it fails.
- config-cube-contract CHECK 3 gates every metric.code ∈ CL_MEASURE of its dataSource's DSD — it is the safety net when adding metrics; run it before trusting a new code.
