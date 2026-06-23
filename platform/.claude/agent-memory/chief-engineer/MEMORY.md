# Chief Engineer — Memory Index

## Project
- [Platform Maturity](project_platform_maturity.md) — what's already built vs genuinely missing; grep before claiming a gap
- [Section Migration](project_section_migration.md) — stalled SectionBlock→SectionShell twins, orphaned ExportBar, divergent geostat tsconfig (use root tsconfig for health)
- [DB i18n divergence](project_db_i18n_divergence.md) — silver ingest validator hardcodes ka|en, diverges from V13/V14 gold locale contract; preview can pass what gold rejects
- [DB schema](project_db_schema.md) — schema topology/model (V1-V15, corrected numbering); SDMX cube, medallion staging, revision logs
- [DB schema gaps](project_db_schema_gaps.md) — genuine non-i18n weaknesses: no unit/measure model, annual time hardcode in query layer, RLS placeholder
- [ADR-0023 code_path](project_adr0023_code_path.md) — SCD-2 hierarchy moved id-chain→code-chain (V23 expand/V24 contract); cluster CLOSED; one wrong trigger-order comment (V24:145)
