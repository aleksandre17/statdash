# PLAN — Full i18n synchronization (every layer switches language, seamlessly)

> Owner ask (2026-07-02): "When I switch the language on the site, NOT everything switches. Every plugin's i18n, every chart, every table, every config must switch language SYNCHRONOUSLY, seamlessly, with the best concepts + architecture."
> Status: **VISION — design tomorrow (architect), then build.** This is the plan/scope; the architect authors the design doc + phased build.

## The observed symptom (probe ground-truth, live prod)
- On every `/ka/...` route, `document.documentElement.lang` reads **`en`** (should be `ka`).
- **Chrome + section titles + KPI labels render in ENGLISH** even on `/ka`, while **data-content** (region/sector names, donut legends, axis labels) renders in **Georgian**. → a MIXED-locale render: some layers subscribe to the active locale, others are pinned/leaked to one language.
- So the locale switch is NOT propagating to every consumer: some strings are resolved at the wrong locale (or never re-resolved on switch), and `<html lang>` isn't bound to the active locale.

## Root hypotheses (confirm tomorrow, empirically — don't theorize-fix)
1. **No single active-locale SSOT that ALL layers subscribe to.** Likely the locale lives in the URL (`/ka|/en`) + an i18n catalog for chrome (i18next), but the config/render layer (LocaleString `{ka,en}`) resolves against a DIFFERENT/stale locale source — so chrome (i18next) and content (LocaleString) diverge. The fix is ONE locale source of truth that every layer reads.
2. **Resolve-at-boundary is incomplete.** AR-26 widened content fields to `LocaleString` + resolves at the render seam. But the probe shows chrome/section titles English on /ka → either those strings are NOT LocaleString (still single-locale i18next keys resolved at the wrong locale), or the resolve seam isn't fed the active locale. Every user-facing string (chrome, section title, KPI label, chart title/axis/legend/tooltip, table header/cells, config-authored labels, methodology, badges) must resolve through the SAME locale boundary.
3. **`<html lang>` not bound to the active locale** → a11y + SEO defect + a signal the locale isn't threaded to the document root.
4. **No re-render on switch.** Switching locale must re-resolve EVERY consumer (like the AR-14 `useThemeVersion` pattern re-renders charts on theme flip). A baked chart SVG / memoized table won't re-translate unless the locale change invalidates it. Charts (ApexCharts draws text to SVG in JS) especially need a locale-keyed remount, same as the theme-version seam.

## The target architecture (best-in-class — the bar)
- **ONE active-locale SSOT** (a `LocaleContext` / signal) derived from the URL, read by EVERY layer (chrome i18next, config LocaleString resolver, charts, tables, KPIs). No layer reads its own locale source.
- **Resolve-at-boundary, everywhere, once** (Law 4 + AR-26): the engine/charts stay locale-AGNOSTIC (never see `{ka,en}`); the React binding layer resolves LocaleString → active-locale string at the single seam, for EVERY user-facing field. A structural fitness (extend `config-no-locale-leak`) asserts NO monolingual leak AND no un-resolved LocaleString reaches a rendered node.
- **Locale-version remount seam** (mirror AR-14 `useThemeVersion`): a `useLocaleVersion` that keys chart/table/canvas remounts so JS-drawn SVG text (Apex axis/legend/tooltip, custom donut/treemap) re-renders on switch — synchronous, seamless.
- **`<html lang>` + `dir`** bound to the active locale (SSR-safe, set before first paint like the no-FOUC theme).
- **Every chrome/label string is either an i18next catalog key (chrome) OR a config LocaleString (content)** — both resolved through the ONE locale source; NO hardcoded single-language literal anywhere (fitness-guarded). Constructor authors bilingual (whole-vertical, AR-26 sibling).
- Reference platforms to benchmark: the resolve-at-render-boundary model (LookML/Cube label i18n, Grafana panel i18n, Vega-Lite `text` expressions bound to a locale signal), i18next best practices (namespaces, fallback chain, `lng` binding), Next-intl/`react-intl` provider-at-root pattern.

## Investigation steps (tomorrow, before building)
1. **Map every user-facing string source** across the vertical: chrome (AppHeader/nav/footer/sidebar), page/section titles, KPI labels + trend text, chart title/subtitle/axis/legend/tooltip/dataLabels, table headers/cells/colLabel, badges (preliminary/updated/methodology), the map legend/tooltip, empty-states, error banners. For each: is it i18next-key or LocaleString, and WHICH locale source does it resolve against?
2. **Find the locale SSOT(s)** — how the active locale is derived (URL param, i18next `lng`, a context) and which consumers read which. Identify the DIVERGENCE (why chrome=en but data=ka on /ka).
3. **Find why `<html lang>` = en** on /ka.
4. **Reproduce a live switch** (ka→en and en→ka) and record, per layer, what does/doesn't switch — the exhaustive miss list.

## Phased build (architect to detail)
- P0: ONE `LocaleContext` SSOT + bind `<html lang>`/`dir`; every locale reader migrates to it (Strangler).
- P1: resolve-at-boundary for EVERY remaining user-facing field (widen leftover single-locale fields → LocaleString or route the i18next key through the SSOT); extend the no-locale-leak fitness to cover them all + assert no unresolved LocaleString reaches a rendered node.
- P2: `useLocaleVersion` remount seam for charts/tables/map (JS-drawn text re-renders on switch).
- P3: Constructor bilingual authoring parity (whole-vertical).
- Gate: real-browser switch ka⇄en on gdp/accounts/regional — EVERY string flips, `<html lang>` correct, charts+tables+KPIs+map+chrome all Georgian on /ka and English on /en, no mixed-locale, no flash.

## Acceptance
Switch language on any page → **every** plugin/chart/table/config/KPI/chrome string switches, synchronously, no reload, no flash, no leftover-language string; `<html lang>` matches; verified real-browser on all 3 pages both directions. Register as an AR-card in the ARCHITECTURE-REGISTRY on design.
