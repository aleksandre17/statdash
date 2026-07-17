# 0080 — Dual sector vocabulary in the dev DB (data-owner decision needed)

**Found during 0078 R2-2 (multi-select dupes root-cause, 2026-07-16):** the `sector` dimension holds TWO current vocabularies simultaneously — the seed short codes (`AGRI`/…, ids 243+, the ones facts realise) AND numeric-NACE codes (ids 16–43) seeded by `ops/postgres/migrations/beforeEachMigrate.sql` for the canonical-workbook path. `DATA/canonical/REGIONAL_GVA.xlsx` uses numeric codes; dev facts use short codes.

**Contained:** the store-level fix (`01d101d`, SDMX CubeRegion per-dataset classifier scoping) is self-healing — surfaces only ever see the realised set. But the dual vocabulary itself is a latent identity fault (joins, future ingests, cross-dataset semantics).

**Decision needed (owner/data-owner):** ONE canonical sector codelist — either migrate canonical workbooks to short codes, or migrate facts+seed to NACE, with an SCD-2 recode path. Route to database-architect when picked up.
