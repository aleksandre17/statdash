---
name: finish-line-recon
description: 2026-06-24 authoritative finish-line recon of statdash-platform — green baseline + completeness gaps + quality/standards debt, verified against code (board proven stale)
metadata:
  type: project
---

Authoritative "what it takes to call statdash-platform DONE at the highest standard" recon, 2026-06-24. Read-only. Verified against CODE; `work/BOARD.md` repeatedly STALE.

**Why:** User wants the real finish-line backlog, not reassurance. The board claims 933-green + many items "deferred"/"DONE" that the code contradicts.

**How to apply:** Use as the backlog seed. Re-verify the lint gate before trusting any "green" board claim — it is the canary.

**Green baseline (measured from platform/):** build:engine GREEN, typecheck GREEN (exit 0), test GREEN (967 passed / 35 skipped / 0 failed — skips are DATABASE_URL-gated fitness tests). **lint RED — exit 1, 2 errors** (+37 react-refresh warnings, accepted). The board's "green" is fiction w.r.t. lint.

**TOP findings (evidence):**
1. LINT GATE RED (blocker — violates own fitness-fn law). `react-hooks/set-state-in-effect` errors at `apps/panel/src/canvas/useDebouncedLivePage.ts:73` and `useLivePreviewStores.ts:88` — synchronous setState in effect (mirror-prop smell). Root-cause fix (derive in render / updater pattern), not a disable. Note: G3.2 debounce was ACTUALLY BUILT (board said "deferred") but landed lint RED — likely never run through `pnpm lint` or react-hooks rule upgraded after.
2. First-tenant erosion in app-agnostic layers (Law 1 / Phase-5 de-tenant). `GeostatEventMap` type threaded through packages/react (EventBus.ts:27/32, SiteRenderer.tsx:32, html.tsx, context.ts:120, engine/index.ts:150 — 11+ sites) — should be `PlatformEventMap` (mirror the correctly-named `PlatformCommandMap`). Also `className:'geostat-snapshot'` html.tsx:231; "GeoStat blue" brand copy in packages/styles/src/catalog/data-color.ts:69. Phase-5 renamed package SCOPE but missed these identifiers/strings.
3. Save-guard locale SSOT bypass (minor-major, the board's deferred I18N-4 follow-on). `apps/panel/src/store/api-actions.ts:58` & :278 call `validatePageForSave(page,{activeLocales: orderLocales(defaultLocale)})` — derives from the DEFAULT locale only, not `site.activeLocales`. A pure `resolveActiveLocales(site.activeLocales, site.defaultLocale)` already exists (useActiveLocales.ts:34) and the Inspector uses it — the gate should too. i18n shift-left gate is partially defeated for non-default active locales. One-line fix per call site.
4. `xlsx` is a dead type-promise. `data:export` command (commands.ts:29) + ExportBar props (ExportBar.tsx:27) advertise `'csv'|'xlsx'`, but export registry (core/src/data/export/index.ts) only registers csv + sdmx-json. useExport is registry-driven so xlsx button never renders. Law 9 says "Excel + CSV every section" → either implement xlsx serializer or narrow the leaky literal union to the registry-derived `string`.
5. `georgraph` typo entrenched in a public node-type discriminant. dir + GeorgraphNode/GeorgraphShell + META.type + catalog + nodes/index + section defaults + 3 fitness tests + committed apps/api/provisioning/geostat.provisioning.json. Constructor palette will display the misspelling. Coordinated rename (serialized type in provisioning JSON).

**Genuinely absent (completeness):** SDMX-P1 leftovers — ref-metadata, quality indicators (DQAF) — confirmed absent (grep-verified, not stale). SDMX REST API surface absent. Judge need vs gold-plating per-tenant.

**Confirmed NOT debt (board/CLAUDE stale the other way):** export is a real registry-driven accessible capability (plugins/CLAUDE.md "stub" is stale). SectionShell.tsx:211 export TODO is a documented justified YAGNI deferral w/ ADR. Most "hardcoded" grep hits are comments asserting ABSENCE of hardcodes (disciplined). No logic-in-config (getRows/val) leaks found. Dependency-arrow eslint gate is real and enforcing.
