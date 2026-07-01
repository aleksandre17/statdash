---
name: project-i18n-db
description: How I18N actually works in the PG database today — JSONB label bags vs the already-normalized classifier_display.locale row model; canonical image; the V13/V14 i18n design
metadata:
  type: project
---

DB I18N has TWO co-existing patterns today (the inconsistency that justifies the V13/V14 work):

1. **JSONB bags** (`label`/`title` `{"ka":..,"en":..}`) on stats.dimension, stats.classifier,
   stats.dataset, config.page, config.nav_item, config.site_config, config.data_*. Short codes `ka`/`en`,
   no registry, no BCP47, no fallback, no completeness enforcement.
2. **Normalized per-locale row** — `stats.classifier_display(member_id, locale, display JSONB)` PK
   (member_id, locale), seeded with `locale='ka'` default. This is ALREADY the relational-translation model
   for the display overlay. Any V13/V14 design must stay consistent with it (same `config.locale` FK target).

**Why:** prompt called the JSONB bags "not an I18N standard"; the fix is a `config.locale` registry +
resolver/validate functions, NOT a rip-to-translation-tables (display table proves the normalized model is
reserved for the editorial overlay, structural labels stay JSONB).

**How to apply:** recommend `ka`/`en` short subtags KEPT (SDMX uses language subtags, labels are
language- not region-specific) — registry validates them, BCP47-conformant as primary subtags. Don't propose
`ka-GE`. classifier_display.locale must FK to config.locale once it exists.

Canonical DB image = `timescale/timescaledb-ha:pg16` (ops/compose/infra/services/postgres.yml), NOT the
postgres:16-alpine in ops/docker-compose.yml (that older standalone stack uses init scripts; the real one is
Flyway-owned). timescaledb-ha is Debian-based with ICU compiled in → `COLLATE "<locale>-x-icu"` and
`CREATE COLLATION ... provider=icu` WORK. alpine variant would NOT have full ICU. Migrations live at
ops/postgres/migrations/, current head = V12. Next = V13.

Fitness test `platform/apps/geostat/src/__tests__/locale-coverage.test.ts` hardcodes
`REQUIRED_LOCALES=['ka','en']` and walks page configs only (not DB rows). It is the app-layer completeness
check #6 option C. When config.locale becomes SSOT, this array should be derived from it, not hardcoded.

See [[project_db_layer]], [[project_ingestion_architecture]].
