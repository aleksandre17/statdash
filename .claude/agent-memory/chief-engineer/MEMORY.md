# Chief-Engineer Memory Index

> The per-epic review/board snapshots (v13-v21, acl-parity, overnight-parity, statebfix, finish-line, ship-readiness, close-board, master-board, live-product, perspective-axis, db-schema/-gaps, adr0023, platform-maturity, section-migration) were retired in the SSOT-reorg curation — their shipped fixes live in git + `platform/work/*`; the still-open SYSTEMIC patterns were distilled into one file below.

## Project — standing findings & gotchas
- [Systemic findings](project_systemic_findings.md) — 11 still-open cross-cutting classes distilled from the retired review snapshots (async cache-key store-axis, dead 304, i18n bare-string, query time hardcode, unit/measure model, prod-hardening doors, palette stubs, adoption meta-fitness, WCAG floor, live≠HEAD, ADR-0023 residuals) — VERIFY before acting
- [Kit false-green classes](project_kit_false_green_classes.md) — cp1252 hook stdout crashes (truncate SessionStart) + engine-stale project.json paths; how to re-detect a gate that greens while broken
- [AR-38 default asymmetry](project_ar38_default_asymmetry.md) — verified invariant: DimFilterRef `default` honored on KPI path ONLY (query path ignores it → must use `$ne:_T`); page vars resolve $ctx vs filterParams (literal '') not ctx.dims
- [Color-token JS-axis gap](project_color_token_jsaxis.md) — FF-TOKEN-ONLY guards CSS+plugins/react JS but NOT charts/core; brand #0080BE leaks there; pair name-scans with value-scans for brand-neutrality
- [DB i18n divergence](project_db_i18n_divergence.md) — silver ingest validator hardcodes ka|en, diverges from V13/V14 gold config.locale contract; approver preview can green-light a submission gold then rejects
