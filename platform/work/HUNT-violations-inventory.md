# HUNT — Master Violations Inventory (whole-codebase, evidence-backed)

> **Mandate:** find everything before the owner does. Read-only hunt. A separate wave executes.
> **Scope discipline:** the styles-layer + responsive axis are already owned by
> `DESIGN-styles-architecture.md` (brand-FONT leak, dead CSS, `.panel`/Apex co-locate, dual-SSOT) and
> `DESIGN-css-responsive-standard.md` (KPI count-ladder, the 16:9-vs-max-height contradiction,
> breakpoint SSOT). The geograph↔map duplication is owned by `DESIGN-map-consolidation.md` (RX-16).
> **This inventory deliberately does NOT re-list those.** It catches what they DON'T:
> the **JS/TS axis** (brand & color literals the CSS guards never see), **naming/i18n canon**,
> **a guard coverage-hole**, and **process root causes**.
>
> Severity: **P0** correctness/active-brand-leak/contradiction · **P1** brand-leak/canon-violation shipped ·
> **P2** systemic gap (guard hole / app-wide) · **P3** polish/consistency.
> Tag: **SAFE** (byte/behaviour-neutral, one-line revert) · **RISKY** (needs verify).

---

## 0. Headline — the five-class summary

1. **Naming canon broken at the `hero` node** — non-canonical jargon + a *literal* mistranslation, and the
   platform's OWN correct translation of the same English word elsewhere proves it (P1).
2. **Brand leak on the JS axis** — the geostat accent `#0080BE` is hardcoded as a *default* in the
   tenant-agnostic `packages/charts`, in a file whose header claims its colors are "neutral" (P1).
3. **The color-cohesion guard has a coverage hole** — `FF-TOKEN-ONLY` scans `plugins`+`react/src` only;
   `packages/charts` and `packages/core` are unscanned, so #2 (and any future bare hex there) cannot fail
   the build. The guard built to catch exactly this class doesn't reach it (P2, systemic).
4. **The Constructor app (`apps/panel`) is single-locale** — ~191 hardcoded Georgian strings, zero English,
   despite shipping an i18n provider; on a branch named `feat/tenant-agnostic-platform` the authoring tool
   assumes a Georgian operator (P2).
5. **i18n-quality drift in plugin labels** — divergent translations of one term, English jargon leaking into
   `en` labels, and mixed-script `ka` labels (P3).

**What I verified is NOT a problem** (so the sweep is trustworthy, not just a list): no god-files (only one
>400-line file, a test fixture — `apps/api/src/provisioning/__fixtures__/legacy-filter-schemas.ts`, 516 LOC);
shared-package authoring labels are *properly* bilingual via `bi(ka,en)`; the geostat **app** has zero
hardcoded Georgian render strings; every chart/plugin/react color literal is a sanctioned
`cssVar('--token', fallback)` (guarded + runtime-themed); the section Strangler-Fig is **complete**
(`SectionBlock` twin retired, info button wired, per-panel export wired via `PanelExportBar` into
chart/gauge/table). Unused layout nodes (card/grid/stack/…) are **not** dead — they are authorable
Constructor capabilities (Law 8 / M-5).

---

## 1. Naming & i18n canon

| # | P | File:line | What | Violates | Fix direction | Tag |
|---|---|---|---|---|---|---|
| N1 | **P1** | `packages/plugins/nodes/hero/default/meta.ts:8` | Node label `{ka:'გმირი სექცია', en:'Hero Section'}`. `გმირი` = a heroic **person/protagonist** — a literal mistranslation of UI "hero". It is also **not a "Section"** (`HeroNode.ts`: `canHaveChildren:false`, renders a title + card carousel — a page banner/intro). | Principle of Least Astonishment; CLAUDE.md Law 4 (use the standard's real meaning); the migration prompt's named catch | Rename the **node type** `hero`→`page-intro` (or `banner`); label ka `'შესავალი ბანერი'`/`'მთავარი ბანერი'`, en `'Page Intro'`/`'Banner'`. Migrate provisioning (1 instance, line ~ `"type":"hero"`) via expand-contract alias. | RISKY (type rename = config migration) |
| N2 | **P1** | `meta.ts:9` (`icon:'layout-hero'`) | The icon id also carries the non-canonical name. | same as N1 | rename in lockstep with N1. | SAFE |
| N3 | **P2** | `packages/plugins/nodes/section/default/meta.ts:28` vs `nodes/hero/default/meta.ts:8` | **The proof + an overload.** The `section` *emphasis* option value `'hero'` is translated **correctly**: `{ka:'გამორჩეული'('featured'), en:'Hero'}`. So the SAME English word "hero" has **two divergent ka translations** — `გამორჩეული` (right) vs `გმირი` (wrong) — and is **overloaded** across two unrelated concepts (a node type AND a section-emphasis modifier). | DRY/SSOT of ubiquitous language; Least Astonishment | After N1 renames the node, "hero" survives only as the emphasis value; keep but fix its `en` (see N5). The divergence is the evidence the node label is wrong. | SAFE (analysis) |
| N4 | P3 | `nodes/section/default/meta.ts:28` | `emphasis` option **en** label is `'Hero'` — jargon — while its **ka** `'გამორჩეული'` correctly means *featured/prominent*. The en/ka pair disagree in meaning. | i18n parity; jargon-as-label | en → `'Featured'` / `'Prominent'`. | SAFE |
| N5 | P3 | `pages/container-page/landing/meta.ts:7`, `pages/tab-page/default/meta.ts:8`, `panels/kpi-strip/default/meta.ts:8` | Mixed-script `ka` labels: `'Landing გვერდი'`, `'Tab-გვერდი'`, `'KPI სტრიპი'` — untranslated English loanwords inside the Georgian label, vs fully-translated peers (`'სტატისტიკის კარუსელი'`, `'დიაგრამა'`). | i18n consistency | translate the loanword or accept it as a domain term consistently (pick one rule). Low blast-radius. | SAFE |
| N6 | **P2** | `apps/panel/src/**` (≈191 literals; e.g. `canvas/CanvasToolbar.tsx:31-41`, `command/CommandPalette.tsx:78-106`, `features/auth/LoginForm.tsx:36-106`, `features/data-layer/DataSpecEditor.tsx:66`) | The **Constructor UI is single-locale Georgian** — hardcoded `label:`/`aria-label`/error strings with **no English**, although `apps/panel/src/providers/i18nProvider.ts` + `inspector/useActiveLocales.ts` exist. | Platform bilingual law (every package label is `{ka,en}`); tenant-agnostic north-star (branch `feat/tenant-agnostic-platform`); the authoring tool hardcodes a Georgian operator | Route panel chrome through the i18n provider / a `{ka,en}` catalog. Large surface → stage it; first add a fitness scan that fails on a *new* bare-Georgian JSX literal so it stops growing. | RISKY (app-wide; stage) |
| N7 | P3 | `packages/plugins/nodes/geograph/**` | The coined non-word **"geograph"** as a node type. | naming canon | **Owned by `DESIGN-map-consolidation.md` (RX-16)** — the map/geograph consolidation resolves this. Reference only; do not re-list. | — |

---

## 2. Brand & color leaks on the JS/TS axis (the CSS guards never see these)

> The styles docs + `FF-TOKEN-ONLY` (`token-cohesion.fitness.test.ts`) enforce token-only color in CSS and
> in `plugins`+`react/src` JS (accepting `cssVar('--t', fallback)`). The leak is **upstream of that scan**.

| # | P | File:line | What | Violates | Fix direction | Tag |
|---|---|---|---|---|---|---|
| B1 | **P1** | `packages/charts/src/colors.ts:16` | `export const DEFAULT_ACCENT_COLOR = '#0080BE'` — the **exact geostat brand accent** (`apps/geostat/.../index.css:22 --color-accent:#0080BE`) baked as the *default* in the tenant-agnostic charts package. The file header (L1-13) declares these **"Neutral … Neutral grey"** — self-contradicting. A non-geostat tenant whose `DataRow` carries no explicit color renders **geostat blue**. | CLAUDE.md "packages ship zero tenant brand"; SSOT; the file's own stated invariant | The neutral accent seed must be **neutral** (a grey) — or remove the accent default and let the themed `cssVar('--color-accent', …)` at the render site be the only accent source. Brand belongs only at `[data-tenant]`/manifest. | SAFE (with screenshot — accent fallthrough) |
| B2 | P3 | `packages/charts/src/colors.ts:13,19` | `DEFAULT_SERIES_COLOR='#6B7B8D'` (neutral grey) + `DEFAULT_TOTAL_COLOR='#E53E3E'` (action red). These ARE architecturally justified renderer-agnostic wire-seeds (ChartOutput is JSON; `var()` invalid) — but they are **unguarded** (see G1) so the *justified* and the *leaked* (B1) sit side-by-side with no gate distinguishing them. | analysability (a future brand hex here is invisible) | keep, but bring under the guard (G1) with a documented allowlist entry. | SAFE |
| B3 | P3 | `packages/core/src/registry/resolvers.ts:214` | `color: gr >= 0 ? '#00A896' : '#E76F51'` — growth-sign green/red **re-typed inline**, not referenced from any SSOT, and **not present in `colors.ts` at all**. | DRY; SSOT (these semantic colors have no home) | add `DEFAULT_POSITIVE`/`DEFAULT_NEGATIVE` to `charts/colors.ts`; `resolvers.ts` references them. | SAFE |

*(Confirmed clean — do not chase: `HeroGraphic.tsx:6`, `GeoMap.tsx:60`, all `apex/*.ts` hex are
`cssVar('--token', '#fallback')` — sanctioned, runtime-themed, and already guarded.)*

---

## 3. Guard coverage holes & contradictions (process > instance)

| # | P | File:line | What | Violates | Fix direction | Tag |
|---|---|---|---|---|---|---|
| G1 | **P2** | `packages/plugins/nodes/__tests__/token-cohesion.fitness.test.ts:26-28` | `FF-TOKEN-ONLY` roots ONLY at `pluginsRoot` + `react/src`. **`packages/charts` and `packages/core` are never scanned** → B1/B3 cannot fail the build. The guard built to prevent exactly this class has a hole the brand leak slipped through. | Evolutionary Architecture (fitness must cover the surface it claims); this is the *systemic* cause of §2 | extend `targets` to include `charts/src` + `core/src`; allowlist the genuine wire-seeds (B2) with documented reasons; **B1 then fails until fixed**. | SAFE |
| G2 | P3 | `packages/charts/src/colors.ts:1-9` (claim) vs `apex/*.ts` (reality) | The header asserts "the apex adapter layers the themed cssVar fallback **ON TOP** at render time." The apex utils use **zero** literal `var(--…)`; they use the JS `cssVar()` helper (which *does* read the custom prop) — so the claim is *true in effect but mis-described*, and `DEFAULT_ACCENT_COLOR` itself is never "themed on top" when it is the fallthrough value. Comment says X, mechanism is Y. | comments must explain the real *why* | reword the comment to match `cssVar()` reality once B1/G1 land. | SAFE |
| G3 | P3 | `no-tenant-content.fitness.test.ts:50` (`/geostat/i`) | The tenant guard matches only the literal token `geostat`. It would **not** catch the brand *color* `#0080BE` or a brand *font name* — tenant identity leaks on axes the regex doesn't model. | defense-in-depth | complement (not replace) with the value-based scans (G1 for color; the styles-doc F1 for fonts). | SAFE |

---

## 4. Dead code / residue (non-CSS — CSS dead-code is owned by the styles doc §0.2/§4)

| # | P | Evidence | What | Verdict |
|---|---|---|---|---|
| D1 | — | `grep ExportBar`, `SectionShell.tsx:42-144` | **NOT dead (memory was stale).** `ExportBar` is DI-provided (`createDefaultUI.ts:34`) and consumed via `PanelExportBar` in `ChartShell:52`, `GaugeShell:60`, `TableShell:61`. Section-level export is a **documented YAGNI deferral** (`SectionShell.tsx:126`), not an orphan. | KEEP — close the stale "orphaned ExportBar" note. |
| D2 | — | `find nodes/section`, `SectionShell.tsx` | **NOT dead.** Legacy `SectionBlock.tsx` twin is **gone**; info button is **wired** (`onToggleInfo={info.toggle}`, `:113`); methodology disclosure renders (`:117-124`). The migration completed. | KEEP — close the stale "section twins / dead info stub" note. |
| D3 | P3 | `core/data/encoding.ts:241`, `datasources/stats-api.ts:63` | Two `@deprecated` symbols, both documented as intentional backward-compat aliases. | Low: schedule removal once callers migrate; not a leak. |

*Note on exhaustiveness (honest): a full unused-export sweep (`ts-prune`/`knip`) was **not** run in this
read-only pass — I verified the high-value suspects (ExportBar, section twin, the two `@deprecated`) and they
are live or intentional. Recommend wiring `knip` as a CI gate (see R5) rather than asserting zero dead
exports.*

---

## 5. a11y / data-integrity

| # | P | Evidence | What | Status |
|---|---|---|---|---|
| A1 | — | `SectionShell.tsx:102-115`, `SectionMethodology.tsx` | Section info/methodology disclosure is wired (was a flagged WCAG 4.1.2 dead stub) → **resolved**. | KEEP |
| A2 | — | `PanelExportBar` in chart/gauge/table; `LocaleGuard.tsx`; `shellAxe.fitness.test.tsx` exists | Per-panel export, locale guard, and an axe fitness test are present. No new broken a11y/provenance/permalink found in this pass beyond the styles/responsive docs' WCAG invariants (I1–I7). | — |

---

## 6. Systemic root causes (fix the process, not the instances)

1. **Token SSOT is enforced on the CSS axis but not the JS axis above `plugins`.** The CSS token spine +
   `FF-TOKEN-ONLY` are strong, but they stop at `plugins`/`react/src`. Brand/color literals in
   `packages/charts` and `packages/core` are wire-seeds that *must* be literal — so the team relaxed there,
   and a **brand** value (B1) rode in under cover of "neutral default."
   **Guard that prevents return:** extend `FF-TOKEN-ONLY` to `charts`+`core` with a *narrow, reasoned*
   allowlist for genuine neutral wire-seeds (G1). A brand hex then cannot masquerade as neutral.

2. **Naming/translation has no canon gate.** "hero" entered as a node type AND a section-emphasis value with
   *two different* Georgian translations, one wrong — nothing checks that a label means what the type IS, or
   that one English term maps to one Georgian term.
   **Guard:** a fitness test asserting (a) every `meta.ts` `type` is on an allowed canonical-vocabulary list
   (rejects coined jargon like `hero`/`geograph` unless explicitly sanctioned), and (b) a glossary check that
   each English UI term has exactly one `ka` rendering across all metas (would have flagged
   `Hero→{გმირი|გამორჩეული}`).

3. **The bilingual law is enforced in `packages` but abandoned in `apps/panel`.** The Constructor grew
   ka-only because no gate scans the app for bare-locale JSX literals (the platform's `{ka,en}` discipline
   lives in `bi()`/metas, which the panel doesn't use).
   **Guard:** a scan failing on a *new* bare non-Latin string literal in `apps/panel/src/**` JSX
   (ratchet: freeze the current count, drive it down).

4. **Fitness functions are value-blind where it matters.** `no-tenant-content` matches the *token* `geostat`
   but not tenant *values* (`#0080BE`, brand font names). Tenant identity leaks on the axes the regex
   doesn't model (G3).
   **Guard:** pair token-name scans with value scans (brand-color set, brand-font set) sourced from the
   tenant manifest, so "brand-neutral shared layer" is checked on every axis brand actually travels.

5. **No dead-export gate.** Dead-code detection is per-class and manual.
   **Guard:** add `knip`/`ts-prune` to CI so orphaned exports/types/files fail the build (would make the
   D-class self-policing instead of relying on memory).

> **The vital few (Pareto):** land **G1** (close the guard hole) and **B1** (fix the brand-accent default)
> and the highest-blast-radius leak is sealed; add the **naming/glossary** fitness (root cause 2) and the
> `hero`-class cannot recur. Everything else is P3 polish behind those two gates.
