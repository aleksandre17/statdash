---
name: i18n-integrity-ar37-ar39
description: AR-37 leak-proof i18n gates (self-maintaining authoring gate + render gate + chrome-literal) & AR-39 NodeStatusContext integrity consolidation — non-obvious design facts
metadata:
  type: project
---

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
