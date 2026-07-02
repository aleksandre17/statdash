---
name: live-ssot-canonical-vs-retired-bundle
description: The LIVE data SSOT is DATA/canonical/*.xlsx (genuine en labels); ops/seed-data bundle is a RETIRED lane with en=ka placeholder — a diagnosis trap
metadata:
  type: project
---

The Geostat demo-data SSOT is the canonical workbooks **`DATA/canonical/{GDP_ANNUAL,ACCOUNTS_SEQUENCE,REGIONAL_GVA}.xlsx`**, ingested through `POST /api/ingest/canonical` (driver `ops/scripts/n.sh` = `ingest-canonical.sh`, run by prod/staging compose `ingest` one-shot and `validate-local.sh`). Parser: `apps/api/src/ingest/canonical/parse.ts` — reads `name_<lang>` columns from each `CL_<dim>` sheet, gated by active locales (`config.i18n.locales = ['ka','en']`).

**TRAP:** `ops/seed-data/geostat/*.bundle.json` + `apps/api/scripts/seed.ts` (SEED_MODE=direct) is the **RETIRED** lane (ADR-0032; see the describe.skip note in `apps/api/scripts/seed-data.fitness.test.ts`). That bundle stores `label.en = label.ka` (Georgian placeholder — `seed-helpers.ts::labelEn()` returns `ka` verbatim). It also models GDP with `approach` as `measure.metadata`, NOT as a real dim.

**Why:** Diagnosing a data question (e.g. "EN labels stay Georgian") against the retired bundle gives the WRONG answer — the live canonical workbooks carry genuine `name_en` on every CL sheet, so label-locale bugs are render-boundary faults, not seed gaps.

**How to apply:** For any data/label/seed diagnosis, quote the LIVE canonical `.xlsx` (read via the `xlsx` pkg in `platform/node_modules`), never the `ops/seed-data` bundle. Confirm which lane the running instance used before concluding.

Related: [[canonical-gdp-annual-shape]].
