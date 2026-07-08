# AUDIT — LIVE PRODUCT (exhaustive, proactive) — 2026-07-01

> Chief-engineer all-seeing sweep of `http://192.168.1.199:3002` via real Chromium (Playwright 1.61.1).
> 48 captures: {light,dark} × {en,ka} × {landing,gdp,accounts,regional} × {390,768,1440} + clean re-verify.
> Charge: find EVERYTHING before the owner does. Method: full-page screenshots + in-page diagnostics
> (WCAG contrast, horizontal overflow, theme-flip snapshot, white-on-dark leak scan, capability probe, console errors).
> A concurrent lane fixes dark-mode CSS coherence — dark issues are flagged as a CLASS, not duplicated.

## 0. READ THIS FIRST — the audit surface is STALE vs HEAD (process finding, P0-process)
The live CSS bundle (`/assets/index-NyfqALRG.css`) contains an **older, incomplete dark block**:
`--color-surface-frame` has only its LIGHT value (`#f0f3f3`), no dark override. i.e. the `FF-DARK-COMPLETE`
work (tokens.css §474+, HEAD) is **NOT deployed**. Therefore a large share of the dark-mode defects below are
**deploy-lag, not source defects** — they will change the moment a fresh build ships. **Any dark verdict must be
re-run against a redeploy of HEAD.** Green gate ≠ what's live. (This is the same lesson as the styles brief:
verify the real surface.)

Also: two sweep observations were **self-inflicted and are NOT product defects** — excluded from the ranking:
`regional` "Page not found" and `accounts`/`ka-gdp` "429 / Failed to load / dashboard not configured" were caused by
my 48-load burst tripping the API rate limiter (retry-after 42s). Clean single loads render all four pages correctly
(re-verified). They did, however, expose real error-STATE defects (F14–F16 below), which stand on their own.

---

## 1. RANKED INVENTORY  (severity × visibility)

| id | page / mode / component / state | finding | why it degrades / not best-in-class | sev | canonical fix |
|----|--------------------------------|---------|--------------------------------------|-----|---------------|
| F1 | ALL / both / chrome / — | **No theme switcher.** `[data-theme]` is a first-class token axis but there is ZERO UI to toggle it; dark is reachable only via OS `prefers-color-scheme`. Owner already flagged this. | Tableau/PowerBI/Looker/Stripe all ship an explicit theme control. A themable platform with no theme affordance is a half-built capability. | P1 | Register a `ThemeSwitcher` chrome slot (like LocaleSwitcher) writing `data-theme` on `<html>` + persisting to storage/URL. Constructor-discoverable capability node. |
| F2 | ALL / both / section actions / — | **Export (CSV/Excel) is a stub.** Section header has an `actions` extension seam but nothing populates it; `plugins/CLAUDE.md` itself says "Export … (now: stub)". No download anywhere. | ONS/Eurostat/World-Bank baseline = per-section export. Declared in this project's OWN Law 9 + shell law; unmet. | P1 | Ship a per-section Export action (extension into `SectionHeader.actions`) → CSV + XLSX from the already-materialised `DataRow[]`; a reusable capability, not one-off. |
| F3 | ALL EN / both / KPI+charts+badge | **i18n leak: Georgian bleeds into the EN product.** Freshness badge `განახლდა: 2025`, chart legends `რესურსები/გამოყენება`, GDP real-growth trend `რეალური`, expenditure total `მშპ`, Tbilisi-share `თბილისი / საქართველო`. | A bilingual national-statistics site showing the wrong language on every EN page destroys credibility. Root cause is architectural (see §2-A), not a typo. | P1 | Promote the monolingual string contracts (chart `series.name`, page-header badge `{year,range}` template, KPI trend `value`) to `LocaleString`; resolve at the render boundary; re-author the ka-only literals as `{ka,en}`. Add a fitness guard: no non-ASCII in a field typed bare-`string`. |
| F4 | ALL / dark / filter strip + chips | **White-on-dark controls.** Annual/Dynamics perspective strip renders **bright white** on dark; freshness badge, active locale button, stats-item icon chips also stay light. (Owner flagged "time-switcher white-on-dark".) | Broken dark surface = unusable. BUT this is the stale-`surface-frame` token (§0) → **owned by the dark-CSS lane + redeploy**; flagged, not duplicated. | P1 (dark-lane) | Deploy `FF-DARK-COMPLETE` (surface-frame + ~30 Tier-2 roles get dark values). Re-verify after redeploy. |
| F5 | ALL / dark / charts (ApexCharts) | **Chart library is not theme-aware.** Axis/gridline/data-label text stays dark→ dim on dark; bars render pale grey; donut centre label (`GDP 70 329`) near-invisible. | This is **JS-level** (Apex `foreColor`/`grid`/`dataLabels.style.colors`), so the CSS-token lane will NOT fix it. Real at HEAD. Fails WCAG in dark. | P2 | Thread theme into `toApexOptions`: set `chart.foreColor`, grid border, and dataLabel colours from CSS tokens (read via `getComputedStyle` on a token probe, or pass a resolved theme object). |
| F6 | ALL / both / perspective bar | **Empty full-width band holding one right-aligned toggle.** The Annual/Dynamics control sits alone in a wide `surface-frame` strip → reads as an unfinished empty bar (and is the element that goes white in dark, F4). | Wasted vertical band + "is this loading?" ambiguity. Not best-in-class chrome density. | P2 | Don't give the perspective toggle its own full-bleed track; co-locate it in the filter row (right of the selects) or left-align with a label. One row, not two. |
| F7 | ALL / both / preliminary marker | **Raw unstyled `Prelim.` text**, rendered at BOTH section-level and panel-level (redundant), in plain black — while KPI cards use a proper `P` badge. | Inconsistent preliminary signalling; the bare text looks like a debug artifact. Data-integrity badges (IMF/Eurostat) should be uniform. | P2 | One preliminary treatment (the `P`/badge component) reused everywhere; drop the duplicate raw text; resolve black colour to a token (fails in dark too). |
| F8 | GDP / both / Real-growth KPI | **Doubled unit: `+7.5%` value + `%` unit → "+7.5% %".** And the trend/delta slot shows the label `რეალური` instead of a numeric delta. | Numeric presentation bug on a hero KPI. | P2 | Don't append the `%` unit when the formatted value already carries it; supply a real delta (or omit the trend row) for real-growth. |
| F9 | ALL / both / page title / mobile | **H1 page title truncates with ellipsis** ("Gross Domestic Pr…") at ≤390 instead of wrapping. | Truncating the primary page identity is a legibility regression; titles should wrap on mobile. | P2 | Allow the title to wrap (remove `text-overflow: ellipsis` / `white-space: nowrap` on the H1 at narrow widths). |
| F10 | GDP+regional / both / bar charts | **Cramped / clipped chart labels.** Expenditure x-axis category labels overlap (mobile + 1440); regional horizontal-bar data labels clip at the bar end ("42 620.8" cut). | Data-viz legibility; below Tableau/Looker label-collision handling. | P2 | Enable Apex label rotation/ellipsis-with-tooltip on category axes; place horizontal-bar data labels outside the bar or inside with contrast-safe colour. |
| F11 | GDP / both / income treemap | **Treemap over-tall**, dominating the page relative to the paired charts above it. | Visual hierarchy: a secondary breakdown outweighs the primary sections. | P3 | Cap the treemap band (cqi clamp like the other panels); reconcile with the panel-sizing model (see styles brief §3). |
| F12 | ALL / dark / geograph map | Map choropleth keeps its light-blue palette on the dark card; the lightest regions approach the card surface. Renders OK but palette isn't tuned for dark. | Minor legibility; choropleth scale not theme-aware. | P3 | Provide a dark choropleth ramp (token-driven) alongside the light one. |
| F13 | ALL / — / API reliability | **Aggressive rate limit + parallel section fan-out.** Each multi-section page fires many `/api/stats/observations` requests; ~10 rapid loads trip a 429 with a 42s retry-after. | A burst (impatient refresh, many sections) degrades to errors; long recovery. Reliability/observability signal. | P3 | Batch/deduplicate per-page observation requests (API composition), raise the limit or add jittered client retry+backoff; ensure the 42s window is intentional. |
| F14 | ANY / — / section error state | **Error boundary renders the RAW problem-details JSON** to end users (`HTTP 429: {"type":"urn:statdash:problem…","requestId":…}`), unlocalized, leaking `instance` path + `requestId`. | Developer-facing blob in the product; minor info disclosure; not localized. Any error (500/network) shows this. | P2 | Map RFC-9457 problem-details to a friendly, localized message + Retry; log the raw detail (don't render it). |
| F15 | /ka/ / — / fail-soft empty state | Empty-manifest fallback copy ("This dashboard is not configured…") is **English-only on the Georgian locale**, bare/unstyled, no branding, no retry. | Localization + polish gap in a degraded state. | P3 | Localize the fail-soft copy (LocaleString) and give it minimal branded chrome + a retry/home affordance. |
| F16 | /:locale/:badId / — / not-found | "No page is registered for id X" renders **chrome-less, unstyled, no way back**. | Poor 404; dead end. | P3 | Branded 404 inside the app shell (header/nav intact) with a link home. |
| F17 | ALL / — / missing capabilities | No **print** stylesheet, no **share** affordance (per-section anchor link exists; site/section share does not), no **density** toggle, no **fullscreen/expand** chart, no **search** over indicators, no **data/API** access link. | A statistics portal benchmarked against ONS/Eurostat/Stripe-dashboards is expected to offer these as first-class, Constructor-registerable capabilities. | P3 | Add as registered capability nodes incrementally (print CSS is cheap and high-value first). |
| F18 | ALL / both / a11y (untested paths) | Not yet verified: visible keyboard focus rings across controls, `aria-current` on the active nav link, focus-trap on any overlay. sr-only data tables ARE present (good). | WCAG 2.1 AA completeness. | P3 | Explicit keyboard-only pass; add `aria-current="page"`; assert focus-visible tokens in a fitness test. |

---

## 2. SYNTHESIS — the vital-few root causes (fix a CLASS, not N rows)

**A. Monolingual string contracts break i18n (root of F3).** The leaks are not typos — they are *authored ka-only
literals* (`geostat.provisioning.json:10` badge `"განახლდა: {time}"`; `:461/465…` `"series":"რესურსები/გამოყენება"`;
`:1596` trend `"value":"რეალური"`). They render Georgian on EN because the underlying fields are typed **bare
`string`, not `LocaleString`** (chart series `name`, page-header badge `{year,range}` template, KPI trend `value`).
A bilingual dashboard **structurally cannot** localize these. Fix at the contract (promote to `LocaleString` +
resolve at the boundary) and guard with a fitness test (no non-ASCII in a bare-`string` user-facing field). One fix
retires the whole leak class and makes it Constructor-safe.

**B. Theme is a token axis with two missing halves.** (1) No *input*: there is no UI to select a theme (F1).
(2) Incomplete *propagation*: the live bundle's dark block is stale (F4, §0) and the chart library is themed in JS,
outside CSS reach (F5). "Themable" is only true when a role can be *selected*, *every surface flips*, AND the
*chart runtime* participates. Close all three, then a single fitness function can assert "every Tier-2 role + chart
chrome has a dark value."

**C. Degraded/secondary states are unbranded and unlocalized.** Error (F14), empty/fail-soft (F15), not-found (F16),
and the raw `Prelim.`/empty-band chrome (F6/F7) all skip the design system: raw JSON, English-only copy, chrome-less
pages, unstyled markers. The happy path is polished; the edges are not. One "degraded-state kit" (localized message +
shell-wrapped + retry/home + token colours) covers all of them.

**D. Chart-runtime theming & label-collision is a systemic viz gap** (F5, F10, F12): Apex options are built once for
light with no theme/collision strategy. Centralize a `theme → ApexOptions` mapping (foreColor, grid, dataLabel colour,
label rotation, choropleth ramp) so every chart inherits it.

### Missing-capability list (things that should be first-class, registerable config nodes)
1. **Theme switcher** (F1) — owner-flagged.
2. **Export CSV/XLSX per section** (F2) — declared standard, currently a stub.
3. **Print / print stylesheet** (F17).
4. **Share** (site + section-level, beyond the existing per-section anchor) (F17).
5. **Density / compact toggle** (F17).
6. **Fullscreen / expand a chart** (F17).
7. **Indicator search** (F17).
8. **Data / API access link** (open-data expectation) (F17).

### What is GOOD (so we don't regress it)
Light-mode happy path is genuinely strong: hero + KPI carousel + paired sections + treemap + choropleth map all
render cleanly; **no horizontal overflow at any of 360→3440** (the old `_metrics.json` overflow is resolved);
chart↔table toggle, per-section deep-link anchor, sr-only accessibility tables, APG-compliant keyboard on the
perspective tablist, and a fail-SOFT (not fail-hard) manifest boundary are all present and correct.

---

## 3. Evidence / reproduction
- Screenshots + `_diag.json`: `…/scratchpad/shots/` (48) and `…/scratchpad/verify/` (clean re-verify). Sweep script `sweep.mjs`.
- Live-bundle staleness proof: `curl …/assets/index-NyfqALRG.css | grep surface-frame` → single `#f0f3f3` (no dark value).
- i18n root: `apps/api/provisioning/geostat.provisioning.json` lines 10, 461, 465, 502, 650, 654, …, 1596 (bare ka literals).
- Contract root: chart series `name: string` (`packages/charts/src/types.ts`), page-header badge `{year:string; range:string}` (`PageHeaderNode.ts:9`).
- Next action: **redeploy HEAD, then re-run this sweep** to separate deploy-lag (F4) from residual source defects.
