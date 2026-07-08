# DESIGN — Full i18n synchronization (AR-37)

> Authoritative design for AR-37. Absorbs `PLAN-i18n-full-sync.md` (origin-of-record).
> Sibling: `DESIGN-integrity-badge-consolidation.md` (AR-38) rides this seam.
> Owner ask: "when I switch language, NOT everything switches" — nothing left untranslated.
> **Status: DESIGNED (design-only; UI branches in flight — no code touched).**

---

## 0. The finding (root cause, not symptom)

Studying the code: **the locale SSOT is NOT fragmented.** `useLocale()` already resolves
`LocaleContext (URL) ?? SiteContext.locale (manifest default)` — one effective source, every
hook derives from it, and locale is **reactive React state** (unlike theme). The mixed-locale
symptom (`/ka` chrome English while data Georgian; `<html lang>` stuck `en`) has three concrete
roots — none is "two competing locale sources":

- **R1 — `<html lang>`/`dir` never bound.** Nothing in the running app writes
  `document.documentElement.lang`; it is frozen at `index.html`'s `lang="en"`.
- **R2 — coverage holes at the boundary.** Some fields aren't routed through the resolve seam,
  and some are **authored monolingually** in provisioning, so `resolveLocaleString` returns the
  one authored language on BOTH locales (a plain `string` ∈ `LocaleString` is locale-frozen).
  This is the real cause of "section titles / KPI labels English on /ka."
- **R3 — i18next global `language` stuck at `'en'`.** `main.tsx` inits `lng:'en'` and
  `changeLanguage` is never called; `useT` masks it per-call (`{lng}`), but any global reader leaks.

→ This is a **coverage + binding + authoring-integrity** fix behind the existing architecture,
NOT a new locale mechanism (KISS; Chesterton's Fence — the seam is sound, we finish it and lock it).

---

## 1. Current-state map

### 1.1 The SSOT (already singular)
- **URL is the source.** `apps/geostat/src/app/LocaleGuard.tsx` (`/:locale/*`) validates against
  `manifest.i18n.locales`, wraps subtree in `SiteLocaleProvider`.
- **`useLocale()`** (`packages/react/src/context/SiteContext.tsx`) = `URL override ?? manifest default`.
- **Switch** = `LocaleSwitcherShell` rewrites URL segment + `navigate({replace})` → soft nav →
  context re-renders. Reactive state ⇒ most React-prop renderers already re-translate.

### 1.2 Two resolution channels (both keyed on the ONE locale)
- **Content — `LocaleString` resolve-at-boundary.** `resolveLocaleString`
  (`packages/core/src/i18n/types.ts`) + `useResolveLocale`/`useResolveLocaleSafe`. Engine stays
  locale-agnostic (Law 1/4); React resolves at the render seam. `tagLocaleString` at the `$d`
  join lets `resolveNodeRows.resolveRowLocales` localize data cells positively (never structure-guess).
- **Chrome — i18next keys.** `useT(ns)` → `i18next.t(key,{lng:locale})`; catalogs via
  `registerSlice` `META.i18n` + `apps/geostat/src/i18n/feedback.ts`.

### 1.3 Where resolution IS applied (boundary today)
Data rows (`resolveNodeRows`), chart def (`localeChartDef`+`useChartOutput`, memo dep on `resolve`),
table headers/colLabel (`DataTable`), section title/label/subtitle + view-toggle roles
(`SectionShell`/`SectionHeader`), geograph title/label/unit/labelOverrides (`GeographShell`),
page-header freshness badge + KPI trend (AR-26 `template.ts`/`kpi.ts`), nav/logo (`AppHeaderShell`),
OBS_STATUS badges (`StatusBadge`, bilingual `OBS_STATUS_LABELS`).

### 1.4 Where it LEAKS (miss list — code-evident; confirm empirically at build)
1. **`<html lang>`/`dir`** — never set (R1).
2. **i18next global** — never `changeLanguage`d (R3).
3. **Methodology `source`+`lastUpdated`** — `SectionMethodology.tsx` renders them as **raw
   strings** (not `LocaleString`, not resolved). Monolingual by type.
4. **Monolingually-authored content** — any LocaleString-capable provisioning field authored as a
   single-language `string` (likely cause of the live symptom). No code seam fixes a value that
   carries one language — the fix is an authoring-completeness gate + backfill.
5. **Pagination controls** — **not in the codebase today** (table has only `store.limit` truncation
   + footer note; no Next/Prev/Page-N/Rows-per-page UI). Owner demands they localize *when built* →
   design the seam now (§4.P1) so `fix/datatable-scroll` (or follow-up) wires them via `useT('table')`.
6. **Imperative renderers** — Leaflet map (`GeoMap`) mutates DOM imperatively; label re-resolution
   on flip must be verified. Charts are safe (memo dep includes `resolve`).

---

## 2. Target architecture

### 2.1 SSOT + document binding
- **ONE read:** `useLocale()`; URL is the authoritative write (permalink, Law 9). No layer reads
  its own locale.
- **Bind the document (R1):** in `LocaleGuard`, on locale resolution set
  `document.documentElement.lang = locale` and `dir = localeDirection(locale)` in a layout effect
  (before paint, mirroring the synchronous `data-theme` set in `main.tsx`). Add a tiny
  **`localeDirection` registry** (`ltr` default; ka/en `ltr`; Postel-ready for `ar`/`he` `rtl`) —
  agnostic, no per-locale literal in a shell. For hard-load correctness also set `lang` in
  `main.tsx` from the URL (no lang flash on first paint under `/ka`).
- **Sync i18next global (R3):** `i18next.changeLanguage(locale)` on change — the SSOT projecting
  into the chrome-catalog subsystem (belt-and-suspenders with per-call `{lng}`).

### 2.2 Resolve-at-boundary, applied UNIFORMLY (Law 4, whole standard)
Invariant: **no user-facing string reaches a rendered node unresolved, and no field a tenant can
author bilingually is left a bare monolingual `string`.**
- Tenant-authored content field → `LocaleString` on the config-facing type + resolved at its shell
  boundary (the `localeChartDef`/`DataTable` pattern), per-slice (ISP — NOT a shared-base widen).
- Fixed UI-chrome string → i18next key via `useT` (never a JSX literal).
- Engine/charts/core NEVER see `{ka,en}` (arrow preserved; core stays locale-agnostic).

### 2.3 Synchronous switch — reactive-first, remount only where needed
Default = thread locale into memo deps (already true for charts via `resolve` identity), NOT a
blanket remount. Add **`useLocaleVersion`** (mirror `useThemeVersion`) ONLY for imperative /
locale-blind-memo renderers:
- **Map (Leaflet)** — fold `useLocaleVersion()` into its remount `key` so tooltip/legend re-resolve.
- Charts already recompute (memo dep) — a locale key is optional insurance.
- Tables re-render from props — no remount.

Trade-off named: **correctness (guaranteed re-resolve) vs. performance/state-preservation** →
resolved by targeting only non-reactive renderers (a page-wide remount would discard
scroll/selection/filter state unnecessarily).

### 2.4 State matrix
| Layer | `/en` | `/ka` | Flips sync? | Mechanism |
|---|---|---|---|---|
| `<html lang>`/`dir` | en/ltr | ka/ltr | yes | §2.1 layout effect |
| i18next global | en | ka | yes | `changeLanguage` |
| Chrome (nav/logo/actions) | EN | KA | yes | `useResolveLocale`/`useT` |
| Section title/label/subtitle | EN | KA | yes | resolved + **authored both** |
| KPI label/trend/unit | EN | KA | yes | resolved + authored both |
| Chart title/axis/legend/tooltip/dataLabels | EN | KA | yes | `localeChartDef` (memo dep) |
| Table headers/colLabel/cells/footer | EN | KA | yes | `DataTable` resolve |
| Data values (`$d` labels, units) | EN | KA | yes | `resolveRowLocales(ctx.locale)` |
| Map title/legend/tooltip/labelOverrides | EN | KA | yes | resolve + `useLocaleVersion` key |
| Methodology note/source/last-updated | EN | KA | yes | **widen→LocaleString + resolve** |
| Pagination (when built) | EN | KA | yes | `useT('table')` keys |
| Preliminary / OBS_STATUS badges | EN | KA | yes | `OBS_STATUS_LABELS` + catalog |

---

## 3. Phased build (Strangler-Fig — each phase green)

- **P0 — Document binding + i18next sync (isolated, zero collision).** Bind `<html lang>`/`dir`
  in `LocaleGuard` (+ pre-hydration in `main.tsx`); `localeDirection` registry;
  `changeLanguage(locale)`. Touches only `LocaleGuard`/`main.tsx`/registry — **no chart/table/
  section file** → land immediately, parallel to in-flight branches. Gate `FF-HTML-LANG-BOUND`.
- **P1 — Complete the content boundary.** Widen methodology `source`/`lastUpdated` → `LocaleString`
  + resolve in `SectionMethodology`. Audit residual tenant-authored fields; widen+resolve per-slice.
  Design pagination-control labels as `useT('table')` keys (for whoever builds them).
- **P2 — Authoring completeness (the real symptom fix).** Backfill every monolingual `LocaleString`
  field in `apps/api/provisioning/geostat.provisioning.json` to carry ALL locales. Gate
  `FF-AUTHORING-LOCALE-COMPLETE`.
- **P3 — Imperative re-render seam.** `useLocaleVersion`; fold into the **map** remount key.
- **P4 — Constructor parity + leak gate.** `LocaleField` on every widened field (rides AR-10/26);
  gate `FF-RENDER-NO-LOCALE-LEAK`.

---

## 4. Fitness gates (leak-proof — invariants as executable contracts)

| ID | Asserts | Where |
|---|---|---|
| **FF-HTML-LANG-BOUND** | `documentElement.lang === locale` & `dir === localeDirection(locale)`, per manifest locale | render harness (mirror `localeString-render-guard`) |
| **FF-AUTHORING-LOCALE-COMPLETE** | every `LocaleString` provisioning field carries ALL `manifest.i18n.locales` | extends `config-label-completeness` + `config-no-locale-leak` fitness |
| **FF-RENDER-NO-LOCALE-LEAK** | render each page per locale, walk DOM text: (a) no `"[object Object]"`; (b) no tenant-script (U+10A0–U+10FF) in `/en`; (c) `/ka` vs `/en` **differ** for the bilingual field set (switch is live, not pinned) | new `apps/geostat/src/data/i18n-full-sync.fitness.test.tsx` |
| **FF-NO-BARE-CHROME-LITERAL** | no hardcoded natural-language literal in shell JSX text/aria (must be `t(...)`/`resolve(...)`) | new lint/fitness over `packages/plugins/**/*Shell.tsx` |
| **FF-LOCALE-VERSION-REMOUNT** | map remount `key` includes the locale-version signal | plugins fitness |

The two power gates: **FF-AUTHORING-LOCALE-COMPLETE** (catches the monolingual-author root that
produced the live symptom) + **FF-RENDER-NO-LOCALE-LEAK** (catches any residual boundary hole in the
real rendered tree, both directions). Together they make "nothing left untranslated" executable.

---

## 5. Trade-offs + rejected alternatives (ADR-style)

- **Complete the existing seam + bind the document; NO new locale mechanism.** KISS/one-seam over a
  redesign. *Rejected:* a `react-i18next`/provider re-architecture — adds a parallel locale source
  (the fragmentation we don't have) and rewrites working code. *Rejected:* flatten `LocaleString` at
  store-build — loses the other language + breaks sync switch; the React boundary is the arrow-clean
  resolution point.
- **Reactive-first re-render; remount only imperative renderers (map).** Performance/state over a
  blunt page-wide remount (locale is already React state). *Rejected:* page-wide remount-on-locale —
  discards UI state every switch.

---

## 6. Sequencing + collision map

See `DESIGN-integrity-badge-consolidation.md` §Sequencing for the combined build order (the two
initiatives share the panel shells). In-flight: `feat/chart-lowcardinality-render` (chart),
`fix/datatable-scroll` (table), pending **#3 directional-crossfilter + NaN fix** (crossfilter/
provisioning).

| Phase | Files | Collides with |
|---|---|---|
| **P0** | `LocaleGuard`, `main.tsx`, direction registry | **none** — land NOW |
| **P1** | `SectionMethodology` + section types, residuals | low |
| **P2** | provisioning JSON + fitness | **#3** (shared JSON) |
| **P3** | `GeoMap`/`GeographShell`, new util | low |
| **P4** | panel/inspector, new fitness | low |

**One-line rule:** *P0 now (isolated); everything that touches a panel shell waits for that shell's
feature branch to land, then i18n-coverage + badge-consolidation (AR-38) land together per shell —
touch each shell once (anti-shotgun-surgery / avoid AR-36's hardcode-then-rework loop).*

---

## 7. Acceptance
Switch language on any page (gdp/accounts/regional), both directions, no reload: every chrome/nav/
title/KPI/chart/table/map/badge/pagination string AND every data value flips; no mixed-locale; no
`[object Object]`; no flash. `documentElement.lang === locale`, `dir` correct, i18next synced.
`FF-AUTHORING-LOCALE-COMPLETE` + `FF-RENDER-NO-LOCALE-LEAK` green. All existing bars hold (build:engine
· typecheck · tsc panel · lint · check-laws · vitest); AR-8/14/15/27/34/35 NOT regressed. Real-browser
verified all 3 pages, both directions, post-redeploy.

_Design 2026-07-03 (architect). Registered AR-37 in `ARCHITECTURE-REGISTRY.md`._
