# SPEC DELTA — new-12 interaction-state shots (companion to SPEC-render-pipeline-target.md)

> **Owner:** platform-architect (Opus). **Date:** 2026-07-02. **Status:** TARGET-SPEC extension. Split for the one-concern-per-file ceiling. Read alongside `SPEC-render-pipeline-target.md` (C1–C7, E1–E10, O-1…O-12, FF suite) and `SPEC-render-pipeline-target.DELTA-6-14.md`.
> **What the 12 new shots (`scriness/new/img*.png`) add:** the earlier shots were single-state (Georgian · light · no region/sector selection). These capture the **conditional / interaction states** — English locale end-to-end, dark/light toggle chrome, region-selected + sector-selected re-query, chart↔table AND map↔table toggles — and in doing so **expose three concrete render bugs** (`[object Object]` subtitle · duplicated region labels · dropped negative sign). READ-ONLY grounding: `platform/packages/core/src/config/filter-derive.ts`, `platform/packages/core/src/data/transform/formatters.ts`, `platform/apps/api/provisioning/geostat.provisioning.json`, `platform/packages/plugins/nodes/{geograph,section}/default/*`.

---

## 1. PER-IMAGE MAP (what each new shot proves)

| Img | Page · locale · theme · state | What it adds / proves |
|---|---|---|
| **img.png** | GDP · **EN** · light · annual (2025) | Locale axis works end-to-end for chrome/section/KPI/nav. **GAP-L:** data-derived category labels (production donut legend, income treemap tiles) stay **Georgian** under EN — the `lookup`-joined `label` LocaleString is not resolved to `ctx.locale` at the legend/tile boundary (same family as Bug 1). |
| **img_1** | GDP · EN · light · annual · **table view** (C7) | Production/expenditure/income sections as tables via the section chart↔table toggle. Confirms C7 dual-view + I-6 (one section data, two encodings) live in EN. |
| **img_2** | GDP · KA · light · **dynamics** · chart | Dynamics grid; real-growth bar shows **2020 = −6.3 below zero** (chart path is signed-correct → contrasts with Bug 3). |
| **img_3 / img_4** | GDP · KA · **dynamics · table view** | **Bug 3 (dropped sign):** real-growth table lists `+7.9%`…`+11%` but **2020 = `6.3%`** (no sign) while the chart (img_2) plots `−6.3`. Table cell + chart disagree → C1 signed-formatter SSOT breach. |
| **img_5** | Regional · KA · annual · sector=**all** · map+donut | Baseline regional annual: choropleth (`რუკა`), sector donut (center 70 329), regional-comparison. Map↔table toggle (`რუკა \| ცხრილი`) visible → C7 covers the map. |
| **img_6** | Regional · KA · annual · sector=all · **right panel = "Sectoral structure — regional comparison" (bar)** | Right-column panel differs from img_5 (donut) → **LV-6:** confirm whether this is a distinct section slot or a state swap. |
| **img_7** | Regional · KA · annual · **table view** · sector=all | Region table + comparison table, **SUM = 80 882.7** (all-sector total), region labels **distinct & correct** (Tbilisi, Adjara, Imereti …) — the CORRECT baseline that Bug 2 violates once a sector is selected. |
| **img_8** | Regional · KA · annual · **sector = "დამამუშავებელი მრეწველობა"** (manufacturing) · table | **Sector-select re-query:** every region panel re-reads sector-scoped; **SUM = 6 758.1** (manufacturing only, vs 80 882.7 all). Confirms the conditional re-query + warm-set change (point 7). |
| **img_9** | Regional · KA · **dynamics** · sector=manufacturing · region-selected · chart | **Bug 1 (`[object Object]`):** map panel subtitle renders literal `[object Object]` (the `{_regionTitle}` label). |
| **img_10** | Regional · KA · dynamics · sector=manufacturing · **table view** | **Bug 1** subtitle `[object Object]` **+ Bug 2:** "by region" table repeats region names (ქვემო ქართლი, თბილისი, თბილისი, ქვემო ქართლი, იმერეთი…) with differing values. |
| **img_11** | Regional · KA · dynamics · sector=**transport** · Tbilisi-selected · table | **Bug 1 + Bug 2 extreme:** every row labeled **თბილისი** (2 587.5, 2 571.8, 1 918.1…) — one row per (geo,**year**), region label collapses. |

---

## 2. THE THREE BUGS — root-cause seam + target fix (DoD: canonical, no hardcode, refine existing)

### Bug 1 — `[object Object]` map subtitle (`img_9,10,11`)

- **Symptom.** The Regional map panel `label` (rendered as the panel subtitle) shows literal `[object Object]` whenever a region is selected. Not mode-specific — it is **region-selected-specific** (the earlier 6 shots simply never selected a region). In the all-regions state the label is empty (join-labels returns its `""` fallback), which is why it looked fine.
- **Root-cause seam.** `platform/packages/core/src/config/filter-derive.ts:163` — the `join-labels` op:
  ```ts
  .map((id) => { const r = src.find((x) => x[idKey] === id); return r ? String(r[lblKey] ?? id) : id })
  ```
  The `label` field in the `geo` codelist is a **`LocaleString` `{ka,en}`**. `String(localeStringObj)` → `"[object Object]"`. The geograph `label` template is `{_regionTitle}` (prov. 3914–3917) and `_regionTitle` is a `join-labels` var (prov. 4494–4504). `resolveTemplate` (template.ts:77–79) *would* resolve a substituted LocaleString correctly — but join-labels has **already String()-flattened it to the literal string** before it reaches the template, so the object-guard never fires. Same latent flaw in `breadcrumbs` (`filter-derive.ts:147`) and in `find`+`field` when the field is a LocaleString.
- **Target fix.** Make the **derive layer localize-at-boundary**, the same discipline `resolveTemplate` already enforces — one LocaleString-resolution SSOT, no `String()` on a bilingual bag. Thread `locale` into `DeriveContext` (from `SectionContext.locale`, via `evalVarMap`'s `scope.ctx` — `evalVarMap.ts:29-33`, which today passes `classifiers/display/raw` but not `locale`) and have `join-labels`/`breadcrumbs` resolve each label with `resolveLocaleString(r[lblKey], locale, locale)` before joining. **DoD:** no `String(<label>)` on a codelist label anywhere; a single-select `join-labels` yields the localized string; multi-select joins localized strings with the separator; guard the whole class with **FF-DERIVE-LOCALIZES-LABELS**.
- **Note (Constructor-readiness).** This is the localize-at-boundary law (Bug 4 axis): every label — chrome, section, KPI, **and data-derived (codelist-joined)** — must funnel through `resolveLocaleString`. The derive ops are the one seam that bypassed it.

### Bug 2 — duplicated / collapsed region labels (`img_10,11`)

- **Symptom.** In sector-selected **dynamics**, the "GDP — by region" table shows one region name **repeated** (img_10: pairs of თბილისი / ქვემო ქართლი) or **every row identical** (img_11: all თბილისი) with differing values. img_7 (annual, all-sector) is correct (10 distinct regions, SUM 80 882.7) — so the fault is state-specific to the range perspective.
- **Root-cause seam.** `platform/apps/api/provisioning/geostat.provisioning.json:3854-3896` (the `geo-map-range` node data). The pipe aggregates:
  ```jsonc
  { "agg":"sum", "by":["geo","time"], "op":"aggregate" }   // line 3857-3862
  ```
  with query `time: {"$ctx":"toYear"}`. **`time` is retained in the group key.** For a *per-region ranking* the group key must be **`["geo"]` only**. When the range perspective leaves `toYear` unpinned (or the window binding folds multiple years into the read), the fetched rows span N years → `aggregate by [geo,time]` emits **one row per (geo, year)** → the `label:"label"` encoding shows the region name only → duplicate/collapsed region labels (img_11 = one region × N years = all-same label). The `lookup`+label join itself is correct; the **extra unpinned dimension in the group key** manufactures the phantom rows. Same dimension-underspecification family as C6/DRIFT-4 (a decomposition that keeps an un-rolled-up dim).
- **Target fix.** A ranking/breakdown table's aggregate **group key = exactly the category dimension it ranks**. For "by region": `by:["geo"]` (roll up `time` — sum over the window per E2 dynamics semantics, or pin `time` to the window's terminal year so exactly one year is read). Never keep an unpinned secondary dim in a ranking's group key. Make illegal states unrepresentable: **FF-RANKING-ONE-ROW-PER-CATEGORY** (a ranking pipe's post-aggregate row count == the distinct category count; a category appearing >1× fails). Cross-check the annual "by region" spec (prov. ~3300s) uses the same `by:["geo","time"]` and only coincidentally yields one row because annual pins a single `time` — normalize both to `by:["geo"]`.
- **[OWNER-CONFIRM O-13]** Range-mode "by region" semantics: **sum GVA over the window** (`by:["geo"]`, agg sum) vs **terminal-year snapshot** (`by:["geo"]`, pin `time=toYear`). DEFAULT = terminal-year snapshot (matches the KPI "toYear total" and the img_7 annual meaning); confirm whether the NSO wants the windowed sum instead.

### Bug 3 — dropped negative sign in the growth table (`img_3,4`)

- **Symptom.** Real-growth **table** shows 2020 = `6.3%` (positive-looking); the **chart** (img_2) plots `−6.3` below zero. The `+` prefix appears on every positive row but the negative row shows neither `+` nor `−`.
- **Root-cause seam.** `platform/packages/core/src/data/transform/formatters.ts:9`:
  ```ts
  const fmtSign = (n) => `${n > 0 ? '+' : ''}${fmtNum(Math.abs(n), 1)}%`   // sign_pct
  ```
  `Math.abs(n)` **strips the sign**, and the ternary only prepends `+` for positives — so `−6.3` → `""` + `"6.3"` = `"6.3%"`. The table column uses `format:"sign_pct"` (prov. 2250). The chart path uses `axes.y.decimals:1` → `fmtNum(v,1)` (formatters.ts:2-7, which *does* render `-6.3`) — hence the two views disagree. `fmtPct` (line 10) has the identical `Math.abs` (fine for always-positive shares, wrong the moment a signed datum flows through it).
- **Target fix (C1 signed-formatter SSOT).** `fmtSign` must be signed: drop `Math.abs` and let `fmtNum` carry the minus —
  ```ts
  const fmtSign = (n) => `${n > 0 ? '+' : ''}${fmtNum(n, 1)}%`   // +7.9% · -6.3% · 0%
  ```
  Table and chart now derive the signed value from the SAME registry (the C1 guarantee: both views read one section `data` and one formatter). **DoD:** `sign_pct(-6.3) === '-6.3%'`; no `Math.abs` inside `sign_pct`; extend **FF-FORMAT-SSOT** with a signed-round-trip case (**FF-SIGN-PRESERVED**: `getFormatter('sign_pct')(-x)` starts with `-`). Leave `pct` as magnitude-only ONLY if every `pct` column is provably non-negative (shares); otherwise a signed column must use `sign_pct`.

---

## 3. NEWLY-VISIBLE AXES (spec as first-class capabilities)

### 4 — Locale as a first-class axis (confirm the resolution boundary)

- **Status.** Chrome / nav / section titles / KPI labels translate correctly (LocaleString → `resolveTemplate` → `ctx.locale`). The **counter-examples** are Bug 1 (derive-layer `String()`) and **GAP-L** (data-category labels stay Georgian under EN, img.png donut/treemap).
- **Invariant I-7 (localize-at-boundary, one SSOT).** EVERY display string — chrome, section, KPI, axis, legend, tooltip, table cell, **and data-derived codelist-joined labels** — resolves through `resolveLocaleString`/`resolveTemplate` at its render boundary. No `String()` on a `{ka,en}` bag anywhere in engine/plugins. The `lookup` pipe op joins the raw `label` LocaleString into rows; the **chart legend / treemap tile / table cell must resolve it to `ctx.locale`**, not render the object.
- **Target.** Bug 1 fix (derive) + audit the `lookup`→legend/tile/cell path (chart-renderers, table cell) for the same guard. **[OWNER-CONFIRM O-14]:** GAP-L — is the Georgian-only category label under EN a **missing `en` in the codelist seed** (→ database-architect, data fix) or a **render-boundary `String()`** (→ engine, same class as Bug 1)? Quick check: does the `sector`/income codelist carry `en`? **FF-NO-LOCALESTRING-TO-STRING** asserts no `String(x)` where `x` may be a LocaleString across engine+plugins.

### 5 — Dark / light theme toggle (☀/☾) — new UI-state axis

- **What.** A root-level theme toggle (visible top-right in all 12 shots), orthogonal to locale/perspective/view. Not previously specced.
- **Target — token-set SSOT.** Theme = a `data-theme="light|dark"` attribute on the document root selecting a CSS-variable token set (all color decisions are `var(--color-*)`; no literal colors in components). Applied **synchronously before first paint** (no-FOUC — already done for the initial theme, commit `fd7a5a0`). **Charts must re-theme:** Apex series/axis colors, GeoMap choropleth ramp, and donut/treemap palettes derive from the CSS tokens at render; on `data-theme` change the chart must **re-read tokens and re-render** (Apex needs an explicit re-init/`updateOptions`, it does not observe CSS var changes). GeoMap fill ramp (`styles/utils/choropleth.ts`, token-derived per AR-25) recomputes on theme.
- **[OWNER-CONFIRM O-15]:** theme persistence + URL/permalink. DEFAULT = persist to `localStorage`, respect `prefers-color-scheme` on first visit; theme is a client display preference, **not** URL-encoded (unlike view-state O-9). Confirm. **FF-CHART-RETHEMES:** a theme flip re-derives chart colors from tokens (no cached light-mode palette on a dark canvas).

### 6 — C7 covers the map view (map ↔ table)

- **Confirmed.** GeographShell (`GeographShell.tsx:74-108`) renders a map + a table child and toggles via `PanelLayout` `views` (`img_5-8` `რუკა \| ცხრილი`). So C7's dual-view applies to the map too — the map is a third `view.role`.
- **Architectural gap (flag).** The map's toggle is a **separate mechanism** (GeographShell/PanelLayout `views` array + `defaultViewIndex`) from every other section's C7 toggle (SectionBlock `view.role` discriminant). Two toggle implementations for one concept = SSOT drift. **Target:** unify — the map becomes `view.role:'map'` under the SAME SectionBlock C7 mechanism (I-6 holds: geograph section owns one `data`; map & table are pure re-encodings — the choropleth and the region table already read the same warmed `rows`). **[OWNER-CONFIRM O-16]:** unify now (fold geograph into the C7 view-role registry — `map` becomes a first-class role) vs keep the geograph's bespoke toggle (defer behind `D-MAP-VIEWROLE`). DEFAULT = unify — a new `view.role` is OCP-clean and removes the second toggle path. **FF-ONE-VIEWTOGGLE:** exactly one active-view mechanism; `map` is a registered `view.role`.

### 7 — Sector-selector on Regional drives a sector-scoped re-query (interaction + warm)

- **What.** A top `select` filter (`paramKey:'sector'`; `img_8` manufacturing, `img_11` transport) pins the `sector` dim into every regional panel's query (`sector:{$ctx:'sector'}`, seen in prov. 3887-3889). Selecting a sector re-scopes the choropleth, sector donut, regional-comparison, and dynamics panels; the **SUM/KPI re-base** (img_7 all = 80 882.7 → img_8 manufacturing = 6 758.1). `_T` = all/rollup.
- **Interaction contract (append to main §3 / DELTA-6-14 §2).** `sector` select → param mutation → every sector-scoped region panel re-reads (conditional re-query); warm-set folds the `sector` pin into `dims` (or drops it for `_T` = wildcard/rollup). No new node type — reuses the `select` ParamDef + `$ctx` binding. Region-select (choropleth click) and sector-select **compose**: img_11 = Tbilisi ∧ transport → the region tables re-scope to Tbilisi within the transport sector (and expose Bug 2's time-not-rolled-up).
- **Warm.** Sector-scoped reqs must be in the warm set for the ACTIVE sector (C2). Because the sector is a filter param (not a perspective), all panels warm at the current `sector` value; changing it re-warms on the next render pass. **FF-SECTOR-REQUERY-WARM:** with a sector pinned, every sector-scoped panel's read key includes the sector pin and is in `warmSet` (no cold read on sector change).

---

## 4. NEW OWNER-CONFIRM LEDGER (O-13…O-16) & LIVE-VERIFY (LV-6)

| # | Decision | DEFAULT / recommendation |
|---|---|---|
| **O-13** | Range-mode "by region" semantics (Bug 2 fix) | **Terminal-year snapshot** (`by:["geo"]`, pin `time=toYear`); confirm vs windowed sum. |
| **O-14** | GAP-L: EN data-category labels stay Georgian — seed gap vs render `String()` | Check codelist for `en`; if present → render-boundary fix (Bug-1 class); if absent → database-architect seed fix. |
| **O-15** | Theme persistence / permalink | **localStorage + `prefers-color-scheme`**, NOT URL-encoded (client display pref). |
| **O-16** | Unify map toggle into C7 `view.role:'map'` vs keep bespoke (`D-MAP-VIEWROLE`) | **Unify now** — one toggle mechanism, OCP-clean. |
| **LV-6** | img_5 (sector donut) vs img_6 (sectoral-structure bar) in the same right-column slot | Confirm distinct section vs state swap (headless capture both states). |

---

## 5. FITNESS FUNCTIONS (append to main §4)

| FF | Asserts | Fixes |
|---|---|---|
| **FF-DERIVE-LOCALIZES-LABELS** | `join-labels`/`breadcrumbs`/`find+field` resolve a LocaleString label via `resolveLocaleString(locale)`; no `String()` on a `{ka,en}` bag in the derive layer. | Bug 1 |
| **FF-NO-LOCALESTRING-TO-STRING** | Static + runtime: no `String(x)` / template-flatten where `x` may be a LocaleString, across engine+plugins (legend/tile/cell included). | Bug 1 / GAP-L / I-7 |
| **FF-RANKING-ONE-ROW-PER-CATEGORY** | A ranking/breakdown pipe's post-aggregate row count == distinct category count; a repeated category fails (group key == the ranked dim only). | Bug 2 |
| **FF-SIGN-PRESERVED** | `getFormatter('sign_pct')(−x)` renders a leading `-`; chart and table format the same signed datum identically. | Bug 3 / C1 |
| **FF-CHART-RETHEMES** | A `data-theme` flip re-derives chart/map colors from CSS tokens (no cached palette). | Axis 5 (theme) |
| **FF-ONE-VIEWTOGGLE** | Exactly one active-view mechanism; `map` is a registered `view.role` (post O-16). | Axis 6 (C7 map) |
| **FF-SECTOR-REQUERY-WARM** | With a sector pinned, every sector-scoped panel read key ∈ warmSet (no cold read on sector change). | Axis 7 (sector select) |

---

## 6. BOARD-ITEM ADDITIONS

- **BI-B1** join-labels/breadcrumbs LocaleString resolution (thread `locale` into `DeriveContext`) + FF-DERIVE-LOCALIZES-LABELS / FF-NO-LOCALESTRING-TO-STRING. (`filter-derive.ts`, `evalVarMap.ts`)
- **BI-B2** Ranking group-key normalization: "by region" (+ annual) `by:["geo"]`, time pinned/rolled-up (O-13) + FF-RANKING-ONE-ROW-PER-CATEGORY. (`geostat.provisioning.json`)
- **BI-B3** `sign_pct` signed formatter (drop `Math.abs`) + FF-SIGN-PRESERVED. (`formatters.ts`) — smallest, highest-visibility fix; land first.
- **BI-AX5** Theme axis: `data-theme` token SSOT + chart re-theme + FF-CHART-RETHEMES. (styles + chart shells)
- **BI-AX6** Unify map into C7 `view.role:'map'` (O-16) + FF-ONE-VIEWTOGGLE. (geograph + section view-toggle)
- **BI-AX7** Sector-select re-query interaction + warm contract + FF-SECTOR-REQUERY-WARM (mostly config + C2 coverage).

**Build order within this delta:** BI-B3 (trivial, visible) → BI-B1 (locale SSOT, unblocks GAP-L) → BI-B2 (ranking rollup) → AX5/AX6/AX7. B1–B3 gate trustworthy verification of the new states.
</content>
</invoke>
