---
name: i18n-content-contract-ar26
description: Where each user-facing content field gets localized (badge perspective-carrier, KpiTrend static, geograph, chart series) and WHY ChartSeries.name is deliberately NOT LocaleString
metadata:
  type: project
---

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
