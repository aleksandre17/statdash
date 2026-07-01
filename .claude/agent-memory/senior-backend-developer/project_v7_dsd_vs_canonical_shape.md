---
name: v7-dsd-vs-canonical-shape
description: V7 migration pre-registers the 3 datasets' DSDs (always applied, cannot neutralize); GDP seeds 3-dim measure,time,geo while canonical GDP is 4-dim time,approach,measure,geo → canonical GDP ingest hits the DSD gate
metadata:
  type: project
---

The Vnn migration **V7__real_dataset_structure.sql** seeds, on EVERY fresh DB (it is versioned schema, not the neutralizable R__ seed):
- 3 datasets (GDP_ANNUAL, ACCOUNTS_SEQUENCE, REGIONAL_GVA), all status=`published`
- their `stats.dataset_dimension` DSD shapes — **GDP_ANNUAL = `measure,time,geo` (3-dim, no `approach`)**, ACCOUNTS_SEQUENCE = `measure,account,side,time`, REGIONAL_GVA = `measure,geo,sector,time`
- 15 placeholder classifier members (geo:3, measure:6, time:6)

The R__seed (gold observations) CAN be neutralized for staging (point Flyway `seed` location away); the **V7 DSD structure CANNOT** (editing an applied Vnn is forbidden).

Consequence for canonical ingest of the 3 workbooks against a fresh DB:
- **ACCOUNTS_SEQUENCE + REGIONAL_GVA** canonical structures MATCH their V7 DSD (reorder only → compatible) → ingest 202 → publish → 415 / 1554 obs. Clean.
- **GDP_ANNUAL** canonical is **4-dim `time,approach,measure,geo`** ≠ V7's 3-dim → the route's `precheckContractCompat` returns **400 DSD_INCOMPATIBLE** (adding `approach` is a structural dsd-change). The DSD gate is working correctly.

**Why:** ADR-0032 D1 assumed staging gold starts with NO pre-registered GDP DSD, so 4-dim GDP would register fresh with no datasetVersion needed. That premise is WRONG — V7 always pre-registers a 3-dim GDP DSD. Proven empirically on the staging stack 2026-06-26.

**How to apply:** Landing canonical 4-dim GDP requires EITHER the versioned path (`?datasetVersion`, which currently hits [[version-mint-locale-incomplete-label]]) OR changing V7's GDP seed to the 4-dim canonical shape (so it registers fresh-compatible). For the ADR-0032 cutover, flag that GDP needs one of these resolutions; ACCOUNTS_SEQUENCE/REGIONAL_GVA do not.
