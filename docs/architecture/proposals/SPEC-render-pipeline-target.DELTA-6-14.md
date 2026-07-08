# SPEC DELTA — img_6…14 (companion to SPEC-render-pipeline-target.md)

> **Owner:** platform-architect (Opus). **Date:** 2026-07-02. **Status:** TARGET-SPEC extension. Split from the main spec to honour the one-concern-per-file ceiling. Read alongside `SPEC-render-pipeline-target.md` (E1–E8, C1–C6, O-1…O-7, FF suite). READ-ONLY grounding: `apps/api/provisioning/geostat.provisioning.json`, `packages/plugins/panels/chart/default/chart-renderers.tsx`, `packages/plugins/CLAUDE.md`.
> **What the 9 new shots complete:** the first 6 covered Regional (both modes) + GDP KPI/growth. These add the GDP **annual component quartet**, the GDP **dynamics panel set**, the per-section **chart↔table toggle**, the whole **SNA / National-Accounts page**, and the **Regional sub-pages** (sector donut, sectoral-structure area, year×sector pivot).

---

## 0. Chart-encoding registry (ground truth, `chart-renderers.tsx`)

`bar · hbar · line · area · waterfall · combo · contribution · pie` → `ApexRenderer`; `hbar-diverging` → `HBarDivergingChart`; `donut` → `DonutChart`; `treemap` → `TreemapChart`; `map`/`sankey` → placeholder. Provisioning `chartType` in use: hbar-diverging(377) · bar(795) · donut(1586) · contribution(1758) · combo(1855) · line(1963) · treemap(2109) · bar(2212) · donut(3303) · bar(3479) · hbar(3643) · bar(3943) · area(4068).

---

## 1. PER-IMAGE BREAKDOWN

| Img | Page · mode · state | What it added / changed |
|---|---|---|
| **img_6** | GDP · **annual** (year=2025) | Full **annual component quartet**: production **donut** (prov. 1586, center total 104 598) · expenditure **`contribution`/waterfall bridge** (prov. 1758; C+I+X−M=GDP; import −55 669.6 down-bar; red `=GDP` total) · income-formation **treemap** (prov. 2109) · capital-formation **donut %** (35.3/29.1/19.3/3.1/2.6). Corrects E6 "bar"→bridge; treemap + donut-% are real encodings, not "donut". |
| **img_7** | GDP · **dynamics** (2010–2025) | Dynamics panel SET, perspective-gated grid (`visibleWhen perspective-is range`, prov. 1796): production→**`combo`** bars-over-time (prov. 1855) · per-capita **`line`** (prov. 1963) · real-growth **bar** (neg 2020 −6.3) · non-observed-value-share **bar**. Confirms panels *swap by perspective* (distinct nodes in gated grids), not one node re-typing. **Reproduces C1 duplicate-tick bug live** (y "12 000, 1 000…"). Real-growth avg KPI still **0.0%** (Drift 3 / C5 live). |
| **img_8** | GDP · dynamics · **table view** | Same dynamics sections as **tables** (year│value) via the C7 toggle. Real-growth table 2010=0%…; share table 23.1%→12.4%. |
| **img_9** | GDP · annual · **table view** | Annual quartet as tables: production (component│value│%); **expenditure bridge as table with import = −55 669.6 and =GDP = 104 598.1 rows** (sign/total identity preserved in the table encoding); income (+…+…=GDP); capital-% (horizontal scroll). C7 dual-view is per-section and lossless-round-trips the bridge's +/−/= semantics. |
| **img_10** | **NEW PAGE — SNA / National Accounts** (`/accounts`, annual, account="ყველა") | **New element E9**: SNA **T-account sequence** as **`hbar-diverging`** (prov. 377, `perspective-is year`) — 6 account groups I–VI as `isSeparator` rows, `series`=Resources/Uses (`side` R/U), `isTotal` closing balances (B1G/B2G/B5G/B6G/B8G/B9), hierarchical (`level`/`parentId`), sorted account `order`→side→`seqPos`→closing. KPIs B5G 196 071 · B6G 215 562 · B8G 3 871 · B9 **−2 836** (neg). Plus per-account sub-charts (production P1/P2/B1G · income B1G/D1/…/B2G · capital B8G/D9R/P5/B9). E8 pivot = this page's table view. |
| **img_11** | Regional · **dynamics** · **region=Imereti selected** | Choropleth with **Imereti highlighted dark** (selection state on `region` param) + chart/table toggle; per-region **annual-dynamics bar** (prov. 3479); **sectoral-structure stacked-`area`** (prov. 4068, 9 sector bands) on the **`სექტორული სტრუქტურა` sub-page** (new left-nav child of Regional). Region-select re-scopes every region panel. |
| **img_12/13** | Regional · **annual** · sector="სახელმწიფო მმართველობა", region=Imereti | Per-region **sector donut** (prov. 3303, center 6 271) + **regional-comparison `hbar`** (prov. 3643) that **collapses to a single Imereti bar (=579)** under the region+sector selection; its x-axis shows the C1 duplicate-tick bug (5,1,15,2,25…). Sector is a top **`select` filter** driving re-query. (img_12 == img_13.) |
| **img_14** | Regional · dynamics · **table view** | E2 region table (Tbilisi 42 982.6/53.1%…) + GDP-dynamics table + sectoral-structure **year×sector pivot** with a **`საშუალო` (mean) footer row** — reinforces C5 mean, now also as a table-footer reduction. |

---

## C7 — Section dual-view (chart ↔ table) as a first-class conditional axis

**What.** Every panel section carries **two sibling view children** — `{type:'chart', view:{role:'chart', label:'დიაგრამა'}}` and `{type:'table', view:{role:'table', label:'ცხრილი'}}` (prov. 1595–1644 is the canonical pair). The **SectionBlock** toggles which child renders (`packages/plugins/CLAUDE.md`: "Chart / Table toggle ✅ SectionBlock"). User-driven, orthogonal to perspective and to filters.

**Invariant I-6 (Data-on-section, views-are-pure).** The **section owns `data`**; both view children are **pure re-encodings of the SAME resolved rows** — the table is not a second query. Therefore warm covers the pair **once, at the section**, regardless of which view is active (C2 unaffected; no per-view warm branch). The chart↔table switch is a lossless round-trip of the same tidy rows (Law: Config = SSOT; the two encodings agree by construction — the C1 axis/table magnitude agreement is *guaranteed*, not merely tested, when both read one `data`).

**Mechanism in code terms.** `view.role: 'chart'|'table'` discriminant on children; SectionBlock holds the active-view UI state; both children receive the section's `interpretSpec` rows. Table view = `type:'table'` node (columns/format/`bar.max`/`transforms`); chart view = `type:'chart'` node (`chartType` + encoding). No conditional in config — the toggle is renderer behaviour keyed on `view.role`.

**Warm/format.** No new warm keys. Numbers in BOTH views funnel through C1 (`getFormatter`/`fmtNum`/`compact`). The table footer `sum`/`mean` (img_14 `საშუალო`) is a table `transforms`/rollup reduction — align its mean semantics with C5 (O-5).

**[OWNER-CONFIRM O-9]** Default active view per section (chart-first per ONS progressive disclosure) and whether the active-view choice is **URL-encoded** (Law 9 permalink). DEFAULT = chart-first, view state in the URL per section so a shared link restores it.

**Fitness FF-DUALVIEW-ONE-DATA:** a section with `role:'chart'`+`role:'table'` children resolves exactly ONE `data` at the section; no child issues its own store read; both formatters resolve through C1.

---

## E9 — SNA / National-Accounts page (`/accounts`) — sequence `hbar-diverging` + pivot

| Aspect | Target |
|---|---|
| **What** | The SNA T-account **sequence** (I. Production → II. Generation of income → III. Primary distribution → IV. Secondary distribution → V. Use of income → VI. Capital) as a hierarchical **`hbar-diverging`** two-sided (Resources/Uses) bar (`img_10`). Plus per-account sub-charts and an E8 pivot as the table view. |
| **Encoding** | `series` = Resources(R)/Uses(U) from the `side` dim (two-colour diverging: რესურსები blue / გამოყენება orange) · `label` = flow label + code (P1/D1/B1G…) · `isSeparator` = account-group header row (I–VI) · `isTotal` = closing balance bar (B1G/B2G/B5G/B6G/B8G/B9) · `level`/`parentId` = tree · negative balances extend left (B9 −2 836). |
| **DataSpec** | `query` over accounts + `pipe`: `join account codelist (order)` → `join aggregates codelist (isClosing)` → `sort by order → side[R,U] → seqPos → isClosing` → shape to diverging rows (prov. 379–437). Warmed (query+pipe). |
| **Perspective** | The sequence chart is `perspective-is year` (annual). **[LV-3]** capture the `/accounts` **dynamics** mode to confirm its dynamics panel set (not in the shots). |
| **Selectors** | Top **account `select`** ("ყველა" = all, or one account group) pins the account dim; year select (annual) / range (dynamics). |
| **Format/Warm/Empty** | Balances via C1; warm per (account,code,side) at the pinned year; empty account → empty sequence with group separators retained. |

---

## E10 (note) — Regional sub-pages: sector donut · regional-comparison hbar · sectoral-structure area/pivot

- **Sector donut** (prov. 3303, `img_12/13`) — per selected region, GVA by sector, center total (6 271). Same family as E6 production donut but on the `sector` dim, region-scoped.
- **Regional-comparison `hbar`** (prov. 3643) — all regions ranked; under a region+sector selection it renders a **single highlighted bar** (`img_12/13`, Imereti=579). See **LV-1**: intended single-region focus vs the C6 component-degeneracy/filter family (should show all regions with one highlighted).
- **Sectoral-structure** (`სექტორული სტრუქტურა` sub-page): stacked-`area` chart view (prov. 4068, `img_11`) ↔ **year×sector pivot** table view with **`საშუალო` mean footer** (`img_14`). This is E4 with a C7 table view whose footer is a C5 mean reduction.

---

## 2. FILTER / INTERACTION CONTRACT EXTENSIONS (append to main §3)

| Interaction | Param mutation | Query re-run | Warm/requirements |
|---|---|---|---|
| **Section view toggle (დიაგრამა↔ცხრილი)** | active-view UI state per section (URL per O-9). No dim/param change. | **No re-run** — both views read the section's already-resolved rows. | **No new warm** (I-6): data warmed once at the section. |
| **Sector select (Regional)** | `sector` dim pins to the chosen member (or `_T`). | Every sector-scoped region panel (donut, comparison, area/pivot) re-reads. | Reqs fold the sector pin into `dims`; `_T` = wildcard/rollup. |
| **Account select (Accounts)** | account dim pins ("ყველა" = all groups). | E9 sequence + per-account sub-charts re-read. | Reqs fold the account pin; separators recompute. |
| **Region select on choropleth** | `region` param (multi, max 10); selected feature gets `FILL_SELECTED`/`WEIGHT_SELECTED` (`img_11` Imereti). | Region-scoped panels (dynamics bar, sector donut, sectoral area/pivot) re-scope to the selection. | Selected geo pins fold into `dims`; wildcard when "all". |

---

## 3. NEW OWNER-CONFIRM LEDGER (O-8…O-12)

| # | Decision | DEFAULT / recommendation |
|---|---|---|
| **O-8** | E6 expenditure encoding name: `contribution` vs `waterfall` (registry has both → `ApexRenderer`). | Keep **`contribution`** (in use, prov. 1758) as the canonical bridge; treat `waterfall` as its alias/registration. Confirm the `isTotal` closing-bar colour token. |
| **O-9** | Section dual-view default + URL-encoding (see C7). | **Chart-first**, active-view state **in the URL** per section (permalink law). |
| **O-10** | `/accounts` dynamics-mode panel set (unseen). | Assume a dynamics grid mirrors GDP (time-series of the closing balances); **confirm via LV-3**. |
| **O-11** | Income-formation treemap: does it carry a `=GDP` total tile, and are the +/− signs on the bridge/income identity data-driven (`isTotal`/sign field) or encoding-driven? | Sign + total are **data-driven** (`isTotal` field, prov. 1743/384). Confirm the treemap should NOT double-count the `=GDP` tile. |
| **O-12** | Regional sector selector semantics: does `sector` default to `_T` (all) and does selecting a sector change the KPI base (img_12/13 KPI=579 = government-only)? | KPI re-bases to the selected sector; `_T` = total. Confirm the comparison-bar scope under O-8/LV-1. |

---

## 4. LIVE-VERIFY FLAGS (need a headless-browser pass)

- **LV-1** — Regional-comparison `hbar` collapses to a single Imereti bar under region+sector selection (`img_12/13`, =579). Intended single-region focus, or the C6 degeneracy/filter family (should rank all regions, highlight one)? Broken x-axis ticks there are separately C1.
- **LV-2** — Section chart↔table toggle: is the active-view state persisted in the URL (Law 9) and restored on reload/share? (drives O-9.)
- **LV-3** — `/accounts` in **dynamics** mode: capture the panel set (unseen in shots) to finalize E9's dynamics grid (O-10).
- **LV-4** — Choropleth **region-click** interaction in the annual sectoral sub-page: does clicking a region re-scope the sector donut + comparison + area, and does it agree with the KPI base?
- **LV-5** — Confirm the C1 duplicate-tick bug fires on the GDP-dynamics production `combo` y-axis (`img_7`) and the regional-comparison x-axis (`img_12/13`) — both should be fixed by the single C1 compact-formatter seam.

---

## 5. FITNESS FUNCTIONS (append to main §4)

| FF | Asserts | Fixes |
|---|---|---|
| **FF-DUALVIEW-ONE-DATA** | A section with `role:'chart'`+`role:'table'` children resolves ONE `data` at the section; neither child issues a store read; both format through C1. | C7 / I-6 |
| **FF-BRIDGE-CLOSES** | The `contribution` bridge's signed components sum to the `isTotal` closing bar (C+I+X−M == GDP; SNA closing balances == their component sum) — the identity holds numerically. | E6 / E9 |
| **FF-DIVERGING-TREE-ORDERED** | `hbar-diverging` rows are ordered account→side(R,U)→seqPos→closing with group separators present; no orphan `parentId`. | E9 |
| **FF-TABLE-FOOTER-MEAN** | A table `საშუალო`/mean footer uses the C5 `mean` reduction (arithmetic mean, base-year policy per O-5), never CAGR. | C7 / C5 |
