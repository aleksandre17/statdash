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

**P2 backfill was a NO-OP — provisioning is already fully bilingual.** A node replica
(deriving locale bags from `siteConfig.i18n.locales`) found 0 monolingual display fields.
The live mixed-EN/KA symptom was NOT monolingual config; it was (a) chrome shells hardcoding
aria/title literals, (b) methodology source/lastUpdated rendered raw (not resolved), (c) the
already-landed P0 (html lang + i18next global).

**FF-AUTHORING-LOCALE-COMPLETE (self-maintaining, supersedes curated DISPLAY_KEYS)** —
`apps/api/src/provisioning/authoring-locale-complete.fitness.test.ts`. Two invariants:
INV1 every LocaleString bag (object whose keys ⊆ declared active locales) is complete;
INV2 no bare monolingual string under a PURE display key or directly under `methodology`.
"Pure display key" = a bag-key that NEVER also appears as a non-bag value outside binding —
this auto-EXCLUDES polymorphic keys (`value`=KpiTrend bag AND numeric data; `year`=badge arm
AND year value). Curated DISPLAY_KEYS in the older `config-label-completeness` gate MISSES
`brandTitle/tab/sub/copyright/logoAlt/changeText/sectionsLabel/methodology.*` — this gate
derives them from the artifact so a new key can't escape. Active locales read from
`siteConfig.i18n.locales` (the declared SSOT — NOT hardcoded 'ka'/'en'). `footer` is in
BINDING_SEGMENTS (table footer `value:'sum'` is a binding, not display).

**FF-RENDER-NO-LOCALE-LEAK** — `apps/geostat/src/data/i18n-full-sync.fitness.test.tsx`.
Renders every page × locale with `stores={}` (exercises CHROME+structure, where the symptom
lived; data-cell localization is resolveRowLocales' own tests). Asserts: no `[object Object]`,
/en Georgian-free, /ka carries Georgian (U+10A0–U+10FF), ka≠en (switch is live not pinned).
Models the existing `localeString-render-guard` harness.

**Chrome i18n mechanism gap (fixed):** `registerSlice` registered `META.i18n` ONLY for
node/panel/page — chrome slices silently dropped it (ISP/symmetry defect), forcing hardcoded
literals. Now `ChromeSliceMeta.i18n` exists + registerSlice registers it under the `slot`
namespace (`useT('LocaleSwitcher'|'ThemeSwitcher'|'AppHeader')`). Bilingual catalogs live
IN the plugin metas/index.ts (catalog-class → no-tenant-content-exempt; chrome index.ts is
exempt via the `:\s*\w*SliceMeta` annotation match), NOT in the runner (anti-erosion).

**AR-39 NodeStatusContext (`packages/react/src/engine/NodeStatusContext.tsx`):** activates
the Option-D seam SectionShell reserved. `useReportNodeStatus(id,{preliminary})` publishes
upward + returns `published` (true iff a scope exists). `usePanelTitleBadge` is the ONE
publish point — when published it suppresses the local pill (ZERO per-shell edits across
chart/table/gauge/kpi-strip; the M-5 shared hook paid off). Section `useNodeStatusScope()`
OR-folds + renders ONE `.section__integrity` indicator (token `--status-preliminary-*`, dot
+ text, not color-only) + a line in SectionMethodology; info toggle now opens on
`hasMethodology || preliminary`. NodeStatusProvider wraps the BODY only (rendered when open)
→ collapsed section drops auto-detect but keeps the authored override — PARITY with the prior
per-panel-badge behavior (badges also only rendered when open), so NOT a regression.
`methodology.preliminary` is a RUNTIME author-override field but deliberately NOT in the
PropSchema (would trigger gen:schema page-config.schema.json drift — Constructor wiring is P4).

**FLAGGED for owner (unfixed, ADR tension):** `apps/geostat/src/i18n/feedback.ts` is en-only
→ generic runner chrome (EmptyState "No data", ExportBar, standalone PreliminaryBadge,
SharePermalink) renders ENGLISH on /ka. Fix = wire the manifest i18n catalog load (ADR-0028's
intended-but-unwired path); baking ka into the de-tenanted runner would erode it (one-way door).
Also flagged: `regional` page title is `{ka:'regional',en:'regional'}` (placeholder).

See [[i18n-content-contract-ar26]], [[i18n-label-and-law4-placement]], [[law4-i18n-check]].

---

## i18n content contract ar26
> Where each user-facing content field gets localized (badge perspective-carrier, KpiTrend static, geograph, chart series) and WHY ChartSeries.name is deliberately NOT LocaleString

AR-26 (commit d3c56b7) fixed the audit-F3 leak class: user-facing content typed bare
`string` → bilingual impossible → provisioning authored ka-only → Georgian on every EN page.
The rule is: WIDEN the field to `LocaleString`, RESOLVE at the EXISTING render seam
(engine/charts stay locale-agnostic, Law 4), AUTHOR `{ka,en}` in provisioning.

**Where each content field resolves (the SEAMS — non-obvious):**
- page-header **badge** is a `PerspectiveCarrier = Record<perspectiveId, LocaleString>`
  (perspective × locale are ORTHOGONAL axes). Collapsed in `core/config/template.ts`
  `resolveCarrier` — active perspective arm THEN active locale (`collapseLocale`).
- **KpiTrendSpec** `static.value` (e.g. 'Stable'/'Real') → LocaleString, resolved in
  `core/data/kpi.ts resolveTrend` via `resolveTemplate`.
- **geograph** title/label/unit/`labelOverrides` → LocaleString, resolved in `GeographShell`
  (labelOverrides mapped through `resolve()` before reaching the locale-agnostic GeoMap).

**Chart series `name` — the trap.** It is DATA-derived (`row.series`), NOT a ChartDef
field. So bilingualizing it does NOT happen by widening `ChartSeries.name`. The ROOT is the
untagged transform-inject seam: `core/data/transform/steps.ts` `tagCell` now brands authored
bilingual `lookup`/`group.inject`/`addField` object literals so `resolveRowLocales` collapses
them to the active locale BEFORE the interpreter groups by series. **ChartSeries.name stays a
resolved `string`** — widening it would push a `{ka,en}` bag back INTO the neutral
locale-agnostic ChartOutput and re-leak `[object Object]` (the exact thing localeChartDef.ts
eliminated). Total-row label overrides (`მშპ`→GDP, `სულ`→Total) were a monolingual `expr`
ternary → retired to a bilingual `lookup` keyed on isTotal (rides the same tagCell).

**Why:** the transform-inject tag seam mirrors the `$d` display-join tag (codelist.ts) —
"use the existing mechanism, don't invent one." resolveRowLocales only resolves TAGGED cells,
so an authored bilingual literal MUST be tagged at injection or it stays a raw ka string.

**How to apply:** any new user-facing content field → widen to LocaleString + resolve at the
node's existing template/resolve seam. If the content is a DATA cell (row field), tag it at
its producing transform op, not at the consumer. Guard: `apps/api/src/provisioning/
config-no-locale-leak.fitness.test.ts` — structural scan, no tenant-script codepoint outside a
LocaleString locale arm (complements the key-driven `config-label-completeness` gate, which
structurally can't see badge arms / data-subtree `series` / KpiValueSpec `value`).
See [[law4_i18n_check]] and [[i18n_label_and_law4_placement]].

---

## i18n label and law4 placement
> i18n labelCompleteness fitness (plugins authoring labels) + where bilingual authoring schemas may live (Law-4/no-tenant-content rules) + the gen:schema drift coupling

**labelCompleteness fitness (`plugins/__tests__/labelCompleteness.fitness.test.ts`, X-3/CON-14):** asserts every shipped authoring label (META.label, PropField.label, option.label, group.label, slot.label) is a COMPLETE LocaleString over active locales. Discovery SSOT = `plugins/authoring-metas.ts` (a PURE, COMPLETE roster importing every `default/meta.ts` directly). Do NOT reuse `catalog.ts`/`PALETTE_META`: catalog re-exports SHELL barrels (pulls React/Leaflet → "window is not defined" in node env) AND PALETTE_META omits layout + chrome metas (which carry offenders). Locale set is DERIVED (union of all object-form label locales) + a ≥2 bilingual floor — no hardcoded 'ka'/'en' in the gate. Offenders migrate from bare `'სათაური'` → `{ ka:'სათაური', en:'Title' }` (single-line inline `{ka,en}`).

**Law-4 placement of bilingual authoring schemas — three valid homes:**
- `packages/core/src/config/*-schemas.ts` (param/rowspec/visibility/perspective-scope/op): bilingual, but REQUIRE an ALLOW entry in BOTH `ops/scripts/check-laws.sh` (`LAW4_CATALOG_ALLOW`) AND `platform/tests/no-tenant-content.fitness.test.ts` (`ALLOW` set). `dataIntegritySchema.ts` (in plugins!) is also ALLOW-listed.
- `packages/plugins/**/meta.ts` and `**/*Node.ts`: AUTO-exempt from no-tenant-content TIER-2 (`isCatalogClass` matches `meta.ts$`/`Node.ts$`).
- `apps/**`: NOT scanned at all (no-tenant-content walks `packages/` only).

**Gotcha:** `check-laws.sh` (bash) exempts inline `{ka,en}` lines (has an `en:` sibling) but the vitest `no-tenant-content` TIER-2 flags ANY Georgian script in non-catalog-class `packages/` files regardless of `en:`. So a bare core file with bilingual labels passes bash but FAILS vitest. For a NEW authoring schema whose sole consumer is the panel Inspector, place it in `apps/panel` (co-located with its FieldControl) — keeps the runtime contract in core (type + resolver), avoids both ALLOW edits. This is how value-mappings is split (see [[value-mappings-architecture]]).

**gen:schema drift coupling:** changing any plugin node/panel PropField LABEL re-emits `packages/contracts/schema/page-config.schema.json` (the emitter resolves labels → JSON-schema `title`). `plugins/nodes/__tests__/page-config-schema.fitness.test.ts` asserts live==committed, so you MUST run `pnpm gen:schema` after label edits — even though the artifact is in `contracts/` (a GENERATED file, not hand-authored).

See also [[plugins-shell-test-harness]].
