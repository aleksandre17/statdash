---
name: config-source-versioning-gap
description: dataSource:"X" routes to a cube via config.data_source.config.datasetCode (the SSOT); config.data_source AND config.data_spec have NO version history — destructive PUT/UPDATE — so provisioning JSON is the only clean restore baseline
metadata:
  type: project
---

A spec's `pipe[0].dataSource:"regional"` does NOT name a cube — it routes to one through `config.data_source` where `name=='regional'`, reading that row's `config.datasetCode`. That datasetCode is the SSOT for which cube every regional-sourced spec resolves against. A raw-browse data-spec carries a fixed ~72-measure union (identical across gdp/accounts/regional specs) — the measure blob is NOT per-cube and is NOT a corruption signal; the `dataSource`→datasetCode indirection is the only real cube selector.

Incident (2026-07-20): owner's live auto-save flipped the `regional` source's `config.datasetCode` from `REGIONAL_GVA` → `GDP_ANNUAL` (kept sector dims GDP_ANNUAL doesn't have). Every `dataSource:"regional"` query silently served 25 national GDP combos instead of 110 regional geo×sector combos. The 3 REGIONAL_GVA data-specs were structurally fine — the fault was one field in the source they route through. Restored from the git-tracked provisioning baseline `platform/apps/api/provisioning/geostat.provisioning.json` (dataSources[name==regional].config).

**Why (durable gaps):** `config.data_source` and `config.data_spec` routes (`platform/apps/api/src/routes/config/`) do a destructive `UPDATE` on PUT with **no append-only version history** — the versions/audit trail is PAGES-ONLY (`VersionHistoryDialog`, `GET /pages/:id/versions`). So a single bad auto-save is unrecoverable except from the git provisioning JSON. Provisioning holds `dataSources` + `pages` only — NOT authored data-specs. Also: PUT accepts a datasetCode with declared dims that aren't a subset of that cube's real DSD (no validation), so an internally-inconsistent config persists.

**How to apply:** (1) To diagnose "regional data wrong/empty", check `config.data_source` datasetCode FIRST, not the data-specs. (2) The only clean restore source for config.data_source/data_spec is git provisioning — recommend SCD-2/append-only versioning on these two tables (mirror the page version model) + a PUT guard validating declared dims ⊆ datasetCode's DSD dims. See [[preview-path-store-routing-ssot]] (the renderer-side store-routing SSOT).
