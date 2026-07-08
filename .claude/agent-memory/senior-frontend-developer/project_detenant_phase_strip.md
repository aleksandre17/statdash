---
name: detenant-phase-strip
description: ADR-0028 Phase 2 STRIP — geostat app de-tenanted into a pure generic SDUI runner; what stays/deleted, the emptyManifest fallback, the seed-data consumer re-points
metadata:
  type: project
---

# ADR-0028 Phase 2 (STRIP) — geostat → pure generic runner

Executed the STRIP (the one-way door, after PROVE+TAG were green). See [[project_bootstrap_runner_phasea.md]] for the bootstrap render path this builds on. Authoritative design: architect's `project_detenant_phase_c_adr.md` (ADR-0028).

**Why:** geostat must carry ZERO tenant content (Law 1) — all content lives as provisioning (`apps/api/provisioning/geostat.provisioning.json`) + seed-data (`ops/seed-data/geostat/`). The runner boots content from the API; offline → generic empty state.

**How to apply (the runner shape now):**
- `apps/geostat/src/data/site-manifest.ts` — `bootstrapSite()` is API-first: `GET /api/bootstrap` for manifest + `config.data_source` rows for stores; both fail-soft (emptyManifest / `{}`). `emptyManifest()` is the brand-free fallback: one en-only `__offline` inner-page with a `text` node, empty nav/chrome/modes/datasources, locales `['en']`.
- DELETED from runner: `src/data/{gdp,accounts,regional}`, `store-manifest|metrics|nav.config|chrome-config|site-config|modes.config.ts`, `src/data/pages/`, `src/pages/`, `src/mocks/`, `src/assets/`, `public/data/georgia-regions.geojson`, `public/mockServiceWorker.js`, the export-provisioning + locale-coverage + export-provisioning.fitness tests, `scripts/export-provisioning.ts`.
- STAYS (generic shell): `src/app/**`, `setupRegistrations.ts`, `stats-api.ts`, `fetch-store-manifest.ts`, `stats-registrations.ts`, `i18n/{formatters,feedback}.ts`, `extensions/**`.
- `i18n/feedback.ts` DECISION: KEEP — it backs generic packages/react components (EmptyState, ExportBar, PreliminaryBadge, SharePermalink) = UI chrome, NOT editorial content. But stripped the `ka` locale → en-only baseline; tenant locales arrive via manifest i18n.
- index.html, App/PageLoader skeletons, shared CSS fonts de-tenanted to neutral en/system-ui (no Georgian).

**Consumer re-points (seed-data files are SSOT):** `apps/api/scripts/{seed.ts, verify-parity.ts, seed-pipeline.ts}` now READ `ops/seed-data/geostat/*.bundle.json` (codelists/displays/facts) instead of the deleted TS bundles. seed.ts collapsed the per-dataset seedGdp/seedAccounts/seedRegional into one generic loader (files are pre-projected: codes resolved, geo='GE' injected, seqPos in obs_attribute).

**STOPPED / open (NOT my scope):** `apps/api/scripts/seed-pipeline-payloads.ts` + `export-seed-data.ts` still import the deleted TS (extraction tooling — consumes TS to PRODUCE files, can't re-point). Per ADR D5 they should be DELETED. Left for the api-owner/architect: deciding whether to keep a regenerate-from-TS path. This keeps `tsc -p tsconfig.scripts.json` red on 3 errors in seed-pipeline-payloads.ts until resolved.
