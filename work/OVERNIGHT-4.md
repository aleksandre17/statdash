# 🌙 Overnight #4 — Excel → SDMX ingestion, built + PROVEN end-to-end

## Headline
The whole **canonical Excel → SDMX-cube ingestion** is built, at the highest standard, and
**proven end-to-end on real Postgres** (8/8 e2e green). Your 3 GeoStat files were converted to
flawless canonical workbooks and ingested through the full pipeline to gold. **1572 tests green ·
typecheck 0 · lint 0 · check-laws clean · all on `main`.**

## What exists now
1. **The canonical workbook STANDARD** (best-in-class: SDMX + Frictionless Data Package + Tidy + ISO 639):
   1 dataset = 1 workbook, sheets `STRUCTURE` (DSD) + `CL_<DIM>` (codelists, ka/en columns) + `DATA`
   (tidy, codes only). Classifiers separate, joined by code. Multilingual = one code, N name columns
   (data never duplicated per language).
2. **`DATA/canonical/{GDP_ANNUAL,ACCOUNTS_SEQUENCE,REGIONAL_GVA}.xlsx`** — your 3 files, converted to
   the standard, **DQAF-validated** (GDP identity 32/32, regional reconciliation exact, 0 data loss,
   referential integrity, idempotent). Originals untouched in `DATA/`. The converter (`work/legacy-to-canonical/`)
   even **caught real bugs in your source ENG file** (a year-shifted value column; a label typo) — surfaced, not hidden.
3. **The generic parser + ingestion** (`apps/api/src/ingest/canonical/` + `rules/` + `routes/ingest/canonical.ts`):
   - `parseCanonicalWorkbook` — self-describing, generic over dims (Law 1, no hardcoded `time`/`geo`),
     `name_<lang>` open (config.locale SSOT), attributes generic. xlsx confined to one ACL file.
   - `POST /api/ingest/canonical` — upload the .xlsx; parses at the boundary (worker never sees Excel),
     publishes codelists/displays to gold, leaves **facts staged for curator approval** (the gate preserved).
   - **6 canonicalization improvements** baked in as real seams (ADR-0031): OCP self-describing · codelist/DSD
     declare-OR-reference + versioning · **validation-as-data (VTL-ready RuleSpec)** · **W3C PROV provenance**
     (source_digest + provenance, V32 migration) · **data-contract compat-check** (codelist=open/BACKWARD,
     DSD=governed/FULL) · SIMS/ESMS metadata slot → V31 + reserved **Serializer port** (`?format=`, json now,
     6 formats reserved = the North-Star's one-seam-six-capabilities).
4. **The e2e regression anchor** (`canonical-ingest.e2e.test.ts`) + the live script (`work/ingest-canonical-e2e.sh`).

## The data-integrity guarantees (you asked, now proven)
- **Upload twice → zero duplication** (idempotent receiver + business-key SCD-2 upsert; F-2 409 proven).
- **Edit one row → only it revises** (SCD-2 vintage; history kept, as-of). Missing row ≠ auto-delete (explicit withdrawal).
- **New classifier → auto-upserted; multi-codelist → generic; new/removed dim → governed DSD-version event** (not silent).

## The e2e caught + I fixed 5 REAL latent bugs (the value of proving it)
1. `config.locale`/`stats.dataset` harness schema mismatch · 2. `loadGoldDsdSnapshot` queried a non-existent
`stats.dataset.measure` (500) · 3. compat compared dim ORDER → false-positive on a reorder (our dimKey is a
map → compare the SET) · 4. **`publish.ts`: `SET LOCAL app.X = $1` is invalid Postgres** (SET doesn't bind
params) — the publish path was never run e2e before; → `set_config(name,$1,true)` · 5. the route batched
codelists+facts so facts validated before codelists hit gold → reordered to publish codelists first.

## North-Star (where we stand vs the world's best)
We are AHEAD on the hardest part: **SDMX is our domain model**, not a bolt-on export (rarer than Eurostat/.Stat/IMF
portals). The full best-in-class roadmap collapses to **3 ports + 2 columns** (Serializer / RuleSpec / QuerySpec +
provenance/pid) — all seamed now, build-on-trigger. Top moves when triggered: SDMX-serve, VTL engine, SIMS/ESMS+PROV.
ADRs: `adr_ingestion_build_ready` (ADR-0031), `adr_excel_ingestion`, `adr_statistical_platform_north_star`.

## Next (your call)
- **Deploy + ingest into the live demo:** rebuild the api with the canonical route, run `work/ingest-canonical-e2e.sh`
  against the deployed stack to ingest the 3 canonical files → the front renders YOUR real data. (Note: ingesting into
  the already-seeded prod DB may flag codelist/DSD deltas vs the seed — best run against a fresh DB or review the warns.)
- **The panel drag-drop upload UI** (Phase 2 — the friendly Constructor surface over the route).
- Fix the flagged source-data issues (the GDP_GROWTH seed values; the ENG year-shift in file 1) — data-owner decisions.

State: 1572 tests · typecheck 0 · lint 0 · check-laws clean · all on `main`. e2e-pg torn down.
