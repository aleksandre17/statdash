---
name: i18n-map
description: "Consolidated i18n knowledge — AR-26 content contract (LocaleString widening), AR-37/39 full-sync + integrity badges, label placement under Law 4"
metadata:
  type: project
---

> CONSOLIDATED (lead curation 2026-07-15) from 3 sibling files — one map, zero knowledge dropped.
> Owning agent: trim superseded detail in place on next touch (distillate, not log).

## i18n integrity ar37 ar39
> AR-37 leak-proof i18n gates (self-maintaining authoring gate + render gate + chrome-literal) & AR-39 NodeStatusContext integrity consolidation — non-obvious design facts

Branch `feat/i18n-full-integrity` (un-merged, commit 01e9d6a). Built AR-37 P1/P2 + gates and AR-39.

**P2 backfill was a NO-OP — provisioning is already fully bilingual.** The live mixed-EN/KA
symptom was NOT monolingual config; it was (a) chrome shells hardcoding aria/title literals,
(b) methodology source/lastUpdated rendered raw (not resolved).

**FF-AUTHORING-LOCALE-COMPLETE (self-maintaining, supersedes curated DISPLAY_KEYS)** — two
invariants: INV1 every LocaleString bag (keys ⊆ declared active locales) is complete; INV2 no bare
monolingual string under a PURE display key or directly under `methodology`. "Pure display key" =
a bag-key that never also appears as a non-bag value outside binding — auto-excludes polymorphic
keys (`value`=KpiTrend bag AND numeric data). Active locales read from `siteConfig.i18n.locales`
(the declared SSOT, never hardcoded).

**FF-RENDER-NO-LOCALE-LEAK** — renders every page × locale with `stores={}` (exercises
chrome+structure, where the symptom lived). Asserts: no `[object Object]`, /en Georgian-free, /ka
carries Georgian, ka≠en (switch is live not pinned).

**Chrome i18n mechanism gap (fixed):** `registerSlice` registered `META.i18n` ONLY for
node/panel/page — chrome slices silently dropped it, forcing hardcoded literals. Now
`ChromeSliceMeta.i18n` exists + registerSlice registers it under the `slot` namespace. Bilingual
catalogs live IN the plugin metas/index.ts (catalog-class, no-tenant-content-exempt), not the
runner (anti-erosion).

**AR-39 NodeStatusContext (`packages/react/src/engine/NodeStatusContext.tsx`):**
`useReportNodeStatus(id,{preliminary})` publishes upward; `usePanelTitleBadge` is the ONE publish
point (suppresses the local pill — zero per-shell edits across chart/table/gauge/kpi-strip).
Section `useNodeStatusScope()` OR-folds + renders ONE `.section__integrity` indicator (dot+text,
not color-only). Note: this scope later MOVED page-level — see [[project_section_scope_and_export]].
`methodology.preliminary` is a runtime author-override field deliberately NOT in the PropSchema
(would trigger `gen:schema` drift; Constructor wiring is a later phase).

**RESOLVED via ADR-019 (was flagged "unfixed" here — superseded 2026-07-18).**
`apps/geostat/src/i18n/feedback.ts` stays en-only by design (Law 3), but the chrome-ns gap it left
is closed: `registerManifestI18n` (`@statdash/react/src/i18n/`, sibling of
`registerManifestMetrics/Dimensions`) loads `manifest.i18n.catalog` — i18next-native
`Record<locale,Record<ns,Record<key,string>>>`, locale-OUTER, riding inside opaque
`site_config.i18n` (zero api schema change) — via `addResourceBundle(locale,ns,keys,deep=true,
overwrite=true)`. Georgian chrome labels (year-select, EmptyState, ExportBar) now live in
`geostat.provisioning.json siteConfig.i18n.catalog` (tenant artifact, zero runner erosion). The
panel's `bootstrapCatalog.ts` ALSO calls `registerManifestI18n` so the live studio canvas previews
a tenant's catalog exactly as the runner renders it (AR-52 canvas-never-lies) — otherwise an
authored label would show right on the runner, wrong (META fallback) on the canvas.
`config-label-completeness.fitness` exempts the `catalog` subtree from its LocaleString-bag model
(it's locale-outer; cross-locale completeness is INV3 below). **Live-deploy caveat:** a new
catalog label needs a remote API reprovision — src-sync alone can't show it (DB-seeded SSOT).

**i18next deep-flag gotcha (LOAD-BEARING):** `addResourceBundle(lng,ns,res,deep,overwrite)` —
**deep=false SHALLOW-merges, new ALWAYS wins regardless of `overwrite`**; `overwrite` only matters
when `deep=true`. A non-clobbering baseline needs **deep=true,overwrite=false**; the catalog
loader uses **deep=true,overwrite=true** (tenant authoritative) — so boot order between the lazy
baseline and the eager catalog load is irrelevant.

**FF-AUTHORING-LOCALE-COMPLETE INV3:** INV1/INV2 walk locale-INNER bags, blind to the locale-outer
catalog. INV3 requires every (ns,key) in ANY catalog locale to exist in EVERY active locale,
non-empty, non-vacuous floor — self-maintaining.

**Law-4 check semantics** (`ops/scripts/check-laws.sh`): greps `packages/core/src` for Georgian
fragments; forbids a SINGLE-LOCALE hardcode, not bilingual content. Exempts lines with an `en:`
sibling + `*-catalog.ts` files. Engine standard: `LocaleString` (core `i18n/types.ts`), resolved
via `resolveLocaleString`/`useResolveLocale`; context-optional components use
**`useResolveLocaleSafe`** (degrades outside `<SiteProvider>`) — see `useTSafe` in
[[project_i18n_runtime_wiring]] for the same pattern on `useT`.

See [[project_i18n_runtime_wiring]].

---

## Content contract (AR-26) — where each field localizes, and why ChartSeries.name is NOT LocaleString
AR-26 fixed the audit-F3 leak class: user-facing content typed bare `string` → bilingual
impossible → provisioning authored ka-only → Georgian on every EN page. The rule: WIDEN the field
to `LocaleString`, RESOLVE at the EXISTING render seam (engine/charts stay locale-agnostic, Law
4), AUTHOR `{ka,en}` in provisioning. Non-obvious resolve seams: page-header **badge** is a
`PerspectiveCarrier = Record<perspectiveId,LocaleString>` (perspective × locale are ORTHOGONAL
axes, collapsed in `core/config/template.ts resolveCarrier`); **KpiTrendSpec** `static.value` →
LocaleString via `core/data/kpi.ts resolveTrend`; **geograph** title/label/unit/`labelOverrides`
resolve in `GeographShell` before reaching the locale-agnostic GeoMap.

**Chart series `name` is the trap.** It's DATA-derived (`row.series`), not a ChartDef field, so
bilingualizing it can't happen by widening `ChartSeries.name` — that would push a `{ka,en}` bag
back INTO the neutral `ChartOutput` and re-leak `[object Object]`. The real fix: `core/data/
transform/steps.ts tagCell` brands authored bilingual `lookup`/`group.inject`/`addField` literals
so `resolveRowLocales` collapses them to the active locale BEFORE the interpreter groups by
series (mirrors the `$d` display-join tag). **How to apply:** any new content field widens to
LocaleString + resolves at its node's existing template seam; a DATA cell tags at its producing
transform op, not at the consumer. Guard: `config-no-locale-leak.fitness.test.ts`.

## Label completeness + Law-4 placement of bilingual authoring schemas
`labelCompleteness.fitness.test.ts` asserts every shipped authoring label (META.label,
PropField.label, option/group/slot.label) is a COMPLETE LocaleString over active locales.
Discovery SSOT = `plugins/authoring-metas.ts` (a pure, complete roster importing every
`default/meta.ts` directly — do NOT reuse `catalog.ts`/`PALETTE_META`, which pulls React/Leaflet
or omits layout+chrome metas). Locale set is DERIVED (≥2 bilingual floor, no hardcoded 'ka'/'en').

**Three valid homes for a bilingual authoring schema:** `packages/core/src/config/*-schemas.ts`
(REQUIRES an ALLOW entry in BOTH `check-laws.sh LAW4_CATALOG_ALLOW` AND
`no-tenant-content.fitness.test.ts ALLOW`); `packages/plugins/**/meta.ts`+`*Node.ts` (AUTO-exempt,
catalog-class pattern match); `apps/**` (not scanned at all). **Gotcha:** `check-laws.sh` exempts
inline `{ka,en}` lines (has an `en:` sibling) but the vitest gate flags ANY Georgian script in a
non-catalog-class `packages/` file regardless — a bare core file with bilingual labels can pass
bash but fail vitest. For a schema whose sole consumer is the panel Inspector, place it in
`apps/panel` instead (co-located with its FieldControl) — avoids both ALLOW edits; this is how
value-mappings is split (see [[project_panel_authoring_features_misc]]).

**gen:schema drift coupling:** changing any plugin/panel PropField LABEL re-emits
`packages/contracts/schema/page-config.schema.json` — run `pnpm gen:schema` after label edits,
even though the artifact lives in `contracts/` (generated, not hand-authored).
