---
name: localestring-display-boundary
description: resolveTemplate is the central funnel that resolves display LocaleString (carrier + template vars) at every render boundary; render-guard fitness
metadata:
  type: reference
---

DISPLAY-side LocaleString resolution (distinct from the row-cell [[localestring-brand]], which is the `$d`-join data-cell path). When ~255 provisioning display strings became `{ka,en}`, several render boundaries passed the raw bag to a React child / String()-flattened it.

- SSOT funnel: `resolveTemplate` (`packages/core/src/config/template.ts`). It now does TWO declarative steps: (1) collapse the **carrier** to one string — `string` passthrough, `{year,range}` perspective union (discriminated by the ENGINE keys `'year' in tpl && 'range' in tpl`, never locale literals — Law 1), else a `LocaleString` resolved via `ctx.locale` (first-value fallback); (2) expand `{key}` vars — and a substituted **var value** that is itself a LocaleString (e.g. a bilingual `account_label` repeat var) is `resolveLocaleString`'d, NOT `String()`-flattened to `[object Object]`. Resolution is idempotent/passthrough for an already-resolved string, so diligent callers are unaffected.
- React seam: `resolveNodeTemplate`/`useNodeTemplate` (`packages/react/.../hooks/useNodeTemplate.ts`) accept `LocaleString | {year,range}` and delegate to resolveTemplate. Shells resolve display fields THROUGH this (`resolve(def.title)` etc.).
- Boundaries that were missing resolution (fixed): page-header `title`+`crumbs`, KPI `unit`+`trendSub` (interpretKpi — `label` already resolved), nav labels (AppHeaderShell + InnerSidebarShell `t(label)`), section view-toggle `roleLabels` (SectionHeader via `useResolveLocale`), chart/table/gauge export-meta `title` (`merged.label`), geograph `title`+tooltip `unit`, DefaultTabPageShell `view.label`. Types widened to LocaleString: KpiSpec.unit/trendSub, ViewParams.label, Crumb.label, NavItemDef/NavSubItem.label, PageHeaderNode.title/badge/crumbs.
- PERMANENT GUARD: `apps/geostat/src/data/localeString-render-guard.fitness.test.tsx` renders every page × locale × perspective and fails on (1) console.error "not valid as a React child" (object-as-child) or (2) "[object Object]" in textContent (String-flatten). Does NOT key off generic "[renderNode] shell crashed" — jsdom `Worker is not defined` (geograph map) is a shell crash but NOT a LocaleString defect (false positive).
- geostat render fitnesses resolve workspace pkgs to TS SOURCE (vitest `conditions:['source',...]`) — no rebuild needed to see edits. Mocks of `@statdash/react` in shell unit tests must add `useResolveLocale` when a shell starts importing it (SectionShell.test.tsx).
