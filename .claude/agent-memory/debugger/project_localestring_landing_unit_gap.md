---
name: localestring-landing-unit-gap
description: Landing/portal React #31 crash — StatItem.unit typed `string` (masked missing resolve) + the render-guard fitness matrix omitted the index/landing page entirely
metadata:
  type: project
---

Live React error #31 ("Objects are not valid as a React child, found object with keys {ka,en}") below the 3 cards on the landing/PORTAL page (index_page_id=`landing`, a `container-page` of hero + stats-carousel).

Root cause: `packages/plugins/nodes/stats-carousel/default/StatsCarouselShell.tsx` rendered `{stat.unit}` RAW (the one display field not passed through `resolve()` = `useResolveLocale`). Masked because `StatItem.unit` in `StatsCarouselNode.ts` was typed `unit: string`, but the 255-string bilingualization made `unit` a `{ka,en}` LocaleString in config — so TS never flagged the missing resolve. Fix: type → `unit: LocaleString` (honest type) + `{resolve(stat.unit)}` (byte-identical for plain strings via `resolveLocaleString` string-passthrough). Two-part fix: make the type honest AND resolve at the boundary.

The GAP that let it ship: `apps/geostat/src/data/localeString-render-guard.fitness.test.tsx` PAGES list was `['gdp','accounts','regional']` — it OMITTED the index/`landing` page. The render-guard matrix must enumerate EVERY shipped page incl. the index/portal page. Added `'landing'` first; gate goes RED (4 landing cases: exact prod error) then GREEN.

**Why / How to apply:** when a config-sourced display field is bilingual but its shell type still says `string`, the compiler can't catch the missing resolve — the render-boundary discipline ([[localestring-structural-flatten]], [[localestring-compose-boundary]]) is only as wide as the fitness matrix that drives it. Any page-render fitness gate must derive/cover the FULL page set (index page included), not a hand-listed subset, or a whole page composition renders untested.
