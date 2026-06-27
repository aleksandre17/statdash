# VALIDATE — Perspective-axis refactor, real-stack render validation

**Date:** 2026-06-27 · **Branch:** `feat/tenant-agnostic-platform` (NOT main — deploy-safe) ·
**Verdict:** ✅ **PASS** — the perspective-axis refactor renders correctly for a real user across
**all 3 pages × both perspectives × both locales (12 surfaces)**. No perspective regressions found.
The only anomalies observed are pre-existing **environment artifacts** (no DB/Worker in jsdom), not
refactor defects — itemized in §Anomalies.

---

## Method used + why

| Path | Status | Reason |
|------|--------|--------|
| (a) Real browser + seeded API/DB (Playwright) | ❌ **environmentally blocked** | `docker` not on PATH; API `:3001/api/bootstrap` → 500 `ECONNRESET` (no DB); `:3002`/`:5171` dead; `ops/seed-data/geostat/` empty. No seeded stack reachable without Docker. Per the hard deploy-safety constraint, the live `:3002` demo was **not** touched. |
| (b) **jsdom full render-path harness** | ✅ **used** | Renders the REAL provisioning manifest through the exact runner composition (`SiteProvider → MemoryRouter → LocaleGuard → AppChrome → NodePageRenderer`), perspective driven by the **URL** (`?mode=range`) — the same path a user's toggle writes. |

**Why (b) is sufficient for THIS refactor:** the perspective axis is a **structural/declarative** change.
The bar toggle, the `KpiSpec.when` partition, and `visibleWhen` filter gates are pure functions of
`(config, perspectiveState)` — they are evaluated **before** any data read (`interpretKpis` filters by
`when` first; `resolveStore` falls back to an empty `staticStore` so nodes degrade gracefully instead of
crashing). Data VALUES (104 598 etc.) are a data-pipeline concern, **unchanged by this refactor** and
already proven against the seeded stack in `work/OVERNIGHT-5.md`; they are env-blocked here and explicitly
out of scope for the axis validation.

**Evidence harness:** `platform/apps/geostat/src/data/perspective-render-validation.test.tsx`
(19 assertions, all green; lint + tsc clean). Manifest loaded verbatim from
`apps/api/provisioning/geostat.provisioning.json`. Raw DOM dumps were read for every combination.

---

## Surface-by-surface results

### 1. Perspective-bar toggle (the new `perspective-bar` node) — ✅ PASS (12/12)

Every page × locale rendered **exactly 2 tabs in order `[year, range]`**, correct localized labels +
icons, `aria-selected` following the URL:

| Locale | Tab 1 | Tab 2 | Icons | Active (no param) | Active (`?mode=range`) |
|--------|-------|-------|-------|-------------------|------------------------|
| ka | `წლიური` | `დინამიკა` | `calendar` / `calendar-range` | წლიური ✓ | დინამიკა ✓ |
| en | `Annual` | `Dynamics` | `calendar` / `calendar-range` | Annual ✓ | Dynamics ✓ |

Raw DOM (GDP): `TABS: ["წლიური|sel=true|icon=calendar","დინამიკა|sel=false|icon=calendar-range"]` (year) →
`["წლიური|sel=false|...","დინამიკა|sel=true|..."]` (`?mode=range`). Identical labels/order/icons to the
pre-refactor `manifest.modes`. The 3rd registered mode (`compare`/`შედარება`) correctly does **NOT** appear
— the page axis declares only `year`+`range`, and the bar is axis-driven (`available.length`), not registry-driven.

### 2. KPI visibility per perspective (`KpiSpec.when` → `perspective-is`) — ✅ PASS (12/12)

Each strip showed **exactly** its perspective's KPIs; the other perspective's KPIs did **not** leak.
Asserted within `.kpi-strip` (present-set ∧ absent-set), per page:

| Page | `year` KPIs (present, range absent) | `range` KPIs (present, year absent) |
|------|-------------------------------------|-------------------------------------|
| GDP | მშპ მიმდინარე ფასებში · რეალური ზრდა · მშპ ერთ სულზე | მშპ — საშ. წლიური ზრდა · ერთ სულზე — საშ. ზრდა · მშპ — საბოლოო წელი |
| Accounts | B5G · B6G · B8G · B9 | დამატ. ღირ. CAGR · გამოშვება CAGR · შრომის წილი · B9 |
| Regional | მთლ. დამატ. ღირებულება · წლიური ზრდა · თბილისის წილი · CAGR(span) | დამატ. ღირ. CAGR · დ.ღ.—{toYear} · დ.ღ.—{fromYear} · საშ. ზრდა |

The retired privileged `KpiSpec.mode` partition is faithfully reproduced by the declarative `when`.

### 3. Filter-item visibility per perspective (`ParamMeta.visibleWhen`) — ✅ PASS (12/12)

Combobox accessible-name inventory per perspective (always-on dims kept; time controls partitioned):

| Page | `year` comboboxes | `range` comboboxes |
|------|-------------------|--------------------|
| GDP | `Year` | `შუალედი:` (from) · `Select` (to) |
| Accounts | `ანგარიში:` · `Year` | `ანგარიში:` · `შუალედი:` · `Select` |
| Regional | `სექტორი:` · `Year` | `შუალედი:` · `სექტორი:` · `Select` |

`year` (year-select) appears **only** in the `year` perspective; `from`/`to` range selects appear **only**
in `range`. Always-on dims (`account`, `sector`) persist across both. No leakage either direction.

### 4. Permalink (Law-9) — ✅ PASS

- Page-level: the **default** perspective (`year`) renders **active from a clean URL** (no `?mode=`) — the
  elided default round-trips (asserted here).
- Full round-trip proof (deep-link restore · derived param name · default-elision · non-default written ·
  full cycle) is covered by the existing real-`FilterProvider` fitness test
  `packages/react/src/context/perspectivePermalink.fitness.test.tsx` (6 cases, green). Re-confirmed.

### 5. Constructor "Perspectives" pane (apps/panel) — ✅ PASS

- Pane + model: `apps/panel/src/features/perspectives/` (`PerspectivesPane.test.tsx`,
  `perspectiveModel.test.ts`) — green.
- **Live-canvas preview seam (the one my prior memory flagged as escalated) has LANDED:**
  `CanvasView.tsx:101` builds `previewEntry = /?${perspectiveKey}=${previewPerspectiveId}` — seeding the
  canvas `MemoryRouter` URL with the same axis param the runner reads, so the authoring preview drives the
  identical URL-perspective mechanism. `CanvasView.test.tsx` green.
- Panel perspective suite: **22 tests pass**.

---

## Anomalies observed (NOT perspective regressions — environment artifacts)

1. **Unresolved template tokens** (`{fromYear}`, `{toYear}`, `{time}`, `{spanFrom}`, `{spanTo}`) in KPI subs
   and section titles in the rendered DOM. **Root cause:** empty `staticStore` ⇒ time-dim filter defaults
   (`{from:'options',pick:'first/last'}`) have no options to resolve ⇒ `ctx.dims` has no time keys ⇒
   `resolveTemplate` leaves the token. This is downstream of the no-data env, **not** the axis — the tokens
   sit on perspective-correct cards. With the seeded stack these resolve to real years (2010–2025), per
   OVERNIGHT-5. (`packages/core/src/data/kpi.ts` resolveTemplate, fed by `withFilter`/`atTime`.)
2. **Regional choropleth panel:** `⚠ Failed to load component / Worker is not defined / Retry` in BOTH
   perspectives. **Root cause:** jsdom has no Web Worker (the geo/Leaflet rasteriser uses one); the node's
   error boundary degrades gracefully to a Retry affordance. Pure env limitation — irrelevant to the axis.
3. **Empty-state i18n divergence:** ka panels show raw keys `empty.title/empty.desc` where en shows
   `No data`. **Root cause:** the harness boots i18next with `resources:{}`; the `ka` UI-chrome feedback
   catalog for the empty-state namespace isn't loaded in-test (en baseline ships in `feedback.ts`). Harness
   catalog gap only — not perspective-related, not present with the live manifest catalog. Flagged for note,
   not routed.

None of (1)–(3) is caused by the perspective refactor; all are absent of any seeded data/Worker and would
not occur on the live stack.

---

## Verdict

**The perspective-axis refactor renders correctly for a real user across all 3 pages (GDP, Accounts,
Regional) in both locales (ka, en) and both perspectives (year, range).** All five user-facing surfaces —
toggle, KPI `when` partition, filter `visibleWhen`, permalink, and the Constructor authoring pane + canvas
preview — behave exactly as the pre-refactor `mode` system did, now on the generic axis. Green is **not**
green-but-broken here: the rendered DOM was read and matches the OVERNIGHT-5 structural yardstick.

**Caveat (honest scope):** data-bound VALUES (104 598 / 7.5% / CAGR 10.6%, chart/map/table contents) were
**not** re-verified — no seeded API/DB/Docker in this environment. Those are a data-pipeline concern,
unchanged by this refactor and already validated in `work/OVERNIGHT-5.md`. To close the value-level loop,
re-run with the seeded stack up (Playwright path (a) via `work/stg-render-probe.js`).
