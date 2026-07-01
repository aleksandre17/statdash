---
name: provisioning-i18n
description: Config-tier label-completeness gate + the display-vs-binding classifier + the field-specific LocaleString resolution asymmetry in the renderer
metadata:
  type: project
---

Bilingualized all user-facing display text in `platform/apps/api/provisioning/geostat.provisioning.json` (Law 4, config tier) and added a permanent guard `apps/api/src/provisioning/config-label-completeness.fitness.test.ts`.

**Why:** the committed manifest is the SSOT a tenant renders; ~255 single-locale (Georgian-only) display literals were a Law-4 violation invisible under one runtime locale but a real defect once client-side locale switching ships.

**How to apply (the classifier — reuse it; the migration and the gate share it as SSOT):**
- DISPLAY keys (→ complete `{ka,en}` LocaleString): `title, subtitle, label, trendSub, unit, colLabel, valueLabel, centerLabel, emptyLabel, suffix`.
- BINDING/exclusion: any of those keys living under a `data | vars | encoding | pipe | query | transforms | options` ancestor is a DATA COLUMN ref / transform logic and stays BARE (e.g. `encoding.label:"time"`, `pipe[].rename.label:"accountLabel"`).
- Left bare by design (consumer-verified, listed not converted): data-pipe-injected `series` values (`from.R/U.series`, `inject.set.series` — become row cells), static `trend.value`, `expr` literals, `vars.tmpl`, page-header `badge.year/range` (a `{year,range}` template union, not a locale map), geograph `labelOverrides.*` (code-keyed map passed straight to GeoMap).

**The renderer LocaleString-resolution is FIELD-SPECIFIC (load-bearing for the concurrent render catch-up):**
- KPI `label` IS resolved: `interpretKpi` does `resolveLocaleString(spec.label,...)` then `resolveTemplate`. `links[].label` IS resolved (`resolveLocaleString`). Chrome shells use `useResolveLocale`.
- KPI `unit`/`trendSub`, section `title/subtitle/label` (via `useNodeTemplate`), page-header `title` (raw passthrough), geograph `title` are NOT locale-resolved today — they go through `resolveTemplate` (or raw), and `resolveTemplate` only handles `string | {year,range}`, NEVER a `{ka,en}` object (its own comment: "caller should resolve LocaleString via useResolveLocale() first"). So those object-valued display fields need a render-side catch-up owned by the concurrent core/plugins workstreams (do NOT widen those — fenced out).

**Mechanical fact:** the JSON round-trips byte-identically through `JSON.stringify(obj,null,2)+"\n"`, so a structured parse→transform→stringify is formatting-preserving (verified by flattening every `{ka,en}` back to `ka` and byte-comparing). See also [[flyway-immutable]] discipline for migrations.
