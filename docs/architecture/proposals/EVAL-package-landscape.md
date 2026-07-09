# EVAL — Package Landscape: adopt / borrow / keep-ours

> **Question (owner):** "Adopt best-in-class packages that *strengthen AND simplify*." A candid self-review found we have mostly **subtracted** (retired react-admin) and **built our own** — are we under-adopting genuine wins?
> **This document:** a rigorous, honest ADOPT / BORROW / REJECT ruling per axis, with reason, what it replaces/adds, cost/risk, Law-3 (arrow) impact, the *strengthen-AND-simplify* test, and a confidence flag.
> **Owner:** platform-architect. **Status:** DRAFT (2026-07-09). Supersedes the scattered package notes in `SPEC-authoring-reconception-{vision,M0}.md` §5 by consolidating them into one ruling.

---

## 0. Honesty constraint (read first)

**No live web access.** Every ruling below is from model knowledge, **not** the packages' current (2025/26) releases. Version-sensitive claims (API shape, a11y coverage, bundle size, feature parity) are flagged **[verify against current release]** and must be checked before any commit. No version numbers or benchmarks are invented here.

**The self-review is fair — and mostly it was right.** We built our own for: the config grammar, the PropSchema Inspector, the canvas, the semantic layer, the stat-tables, DTCG tokens, and the i18n resolve-seam. In each case the external library is either **weaker than what we have** or **breaks a Law** (Config = SSOT · Law 5 `fromSDMX`-only · Law 2 no-logic-in-config). That is not NIH; it is a fit judgment, and it is defensible axis-by-axis below. **But** the review's suspicion is correct in exactly two places: **testing (Playwright)** — a pure win we have been doing *ad hoc* — and, more tentatively, **panel server-state (TanStack Query)**. Those are the real adoptions. Everything else, keep-and-build wins on merit.

---

## 1. Headless UI / design system — MUI+Emotion vs Radix / shadcn / React Aria

**Current:** panel = MUI 6 + Emotion (`@mui/material`, `@emotion/react`). Runner (`geostat`) is correctly **MUI-free, token-driven**. Prior ruling (vision §5): MUI→Radix flagged as north-star, *not* milestone-1.

**Verdict: BORROW / DEFER — direction confirmed, execute Strangler, never big-bang.**

- **Reason.** The panel's MUI theme **competes** with our DTCG token layer (`packages/styles`) — the authoring tool and the product speak two design languages. The right end-state is headless primitives (Radix / Ark UI / React Aria) skinned by *our* tokens, so tool == product. That direction is sound.
- **But the *strengthen-AND-simplify* test fails for a NOW-migration.** A full MUI→Radix swap is **lateral churn**, not a simplification, until it is 100 % complete — MUI is woven through inputs, dialogs, Snackbar (the one live `useNotify`→`notify` port), icons, theme. Ripping it mid-flight while the Studio shell (AR-49 M1) is freshly built = maximum churn for zero user-visible gain.
- **What it replaces / how to do it right.** Adopt **Radix primitives + shadcn-style *copy-in* (owned) components on our tokens** — *not* MUI-style theme-as-dependency — **incrementally, as each Studio surface is (re)built** (Strangler-Fig, Law 7). New surfaces land on Radix; MUI shrinks as surfaces migrate; the last MUI import deletes the dep. **React Aria (Adobe)** is the stronger candidate if WCAG 2.1 AA coverage (Law 9) is the priority — its a11y behaviors are the reference. `shadcn` is *not a dependency* (copy-in code on Radix) — that fits our "own our components" ethos and avoids a new runtime dep.
- **Cost/risk.** Migration cost high (many components); risk **low if Strangler-gated**, high if big-bang. Arrow: **apps/panel only** — no `packages/*` impact, no Law-3 violation.
- **Confidence:** direction high; **[verify against current release]** the Radix vs Ark UI vs React Aria a11y/primitive-coverage comparison before picking the primitive lib.

---

## 2. Charting / viz grammar — Vega-Lite / Observable Plot / ECharts / visx / Recharts vs ApexCharts+d3-geo

**Current:** ApexCharts (default renderer) + custom SVG (donut/treemap/hbar) + d3-geo (map projection). `ChartRegistry` is already **Strategy + plugin** (`registerChart`, last-wins), dispatched by `interpretChart(def) → ChartOutput` (neutral) → `toApexOptions`. AR-14 wires chart chrome to CSS tokens + theme re-render.

**Verdict: BORROW the Vega-Lite *grammar* (spec shape) · KEEP ApexCharts as the default renderer *strategy* · hold ECharts as a consumer-gated 2nd strategy. REJECT visx / Recharts / Observable-Plot-as-config.**

- **Law 4 says adopt Grammar of Graphics / Vega-Lite *whole* — but that is the GRAMMAR (a serializable `mark × encoding × transform` algebra), not the runtime renderer.** Our `encoding.ts` golden rule ("data is never pivoted; the *encoding* says how") is already Vega-Lite's core idea. **Converge `ChartDef` onto a Vega-Lite-*shaped* algebra** so charts become spec-portable and re-encode/pivot (AR-36) is free. Borrow the **design/types-shape**, not the npm package (full `vega-lite` types encode a scenegraph renderer we do not use, and are heavy).
- **Do NOT adopt Vega/Vega-Lite as the RUNTIME.** It ships its own canvas/SVG scenegraph; replacing ApexCharts wholesale = churn, and it does not slot into the AR-14 `cssVar`+theme-remount seam as cleanly as our neutral `ChartOutput`→strategy pipeline. Our registry *already* lets a new renderer be **additive** (`registerChart`), which is the correct extension point.
- **ECharts** — the one credible *second renderer strategy*: strong perf on large series + native sankey/graph (today `sankey`/`map` fall through to `placeholderOutput`). **Consumer-gated (YAGNI):** add it as a strategy *only* when a real chart ApexCharts cannot do appears (sankey, or a big-data perf wall). The seam is ready; do not pre-adopt.
- **visx / Recharts — REJECT:** React-component charting (charts authored as JSX). That fights Config = SSOT (a chart is *config*, not a component tree). **Observable Plot — REJECT as the config layer:** a concise grammar, but an *imperative JS API*, not a persistable spec — non-serializable, fails Law 2.
- **Cost/risk.** ChartDef→Vega-Lite-shape convergence is real work (schedule it under AR-40/AR-42), but additive and inside `packages/charts` — arrow-clean. Keeping ApexCharts = zero cost.
- **Confidence:** ruling high; **[verify against current release]** the current Vega-Lite spec version and ECharts feature set before mirroring types / adding the 2nd strategy.

---

## 3. State / data-fetching / routing — TanStack Query/Table/Router · Redux Toolkit · Jotai vs Zustand + api-actions

**Current:** panel = Zustand 5 + our own api-actions; runner = `DataStore`/`CachedStore` (OLAP observation cache keyed by `ObsQuery`). Routing = react-router-dom 6.22.

**Verdicts:**

- **Zustand — REJECT-KEEP.** Minimal, unopinionated, right-sized. RTK (heavier ceremony) and Jotai (atoms — lateral, no win over Zustand) add nothing. **Confidence high.**
- **TanStack Router — REJECT-KEEP react-router 6.22.** A router migration is pure churn with no clear win. **Confidence high.**
- **TanStack Query — the one genuine ADOPT-CANDIDATE (spike first).** It is the *reference* for **server-state**: dedupe, background refetch, stale-while-revalidate, cache invalidation. The **panel's** authoring server-state (load `/api/bootstrap`, `/api/config`, cube profiles; save config) is exactly its sweet spot, and our api-actions + a hand-rolled cache **reimplement a slice of it**. It could simplify loading/error/cache handling and dull the **stale-cache bug-class** the F-section initiatives (AR-41) call out.
  - **Critical honesty / scope fence.** It does **NOT** replace `DataStore`/`CachedStore` — those are a *domain* OLAP store keyed by SDMX `ObsQuery`, not a generic HTTP query-key cache. TanStack Query's scope is the **panel's HTTP/authoring server-state ONLY**. Adopting it there is **apps/panel-only** — no arrow impact.
  - **The test:** *does it strengthen AND simplify?* Probably yes for panel fetch/save — **but only if it genuinely displaces api-actions rather than sitting beside them** (two cache paradigms = worse). **Requires a spike** to measure overlap before commit.
  - **Confidence medium.** **[verify against current release]** TanStack Query v5 API + how much of it api-actions already cover cleanly.
- **TanStack Table — REJECT-KEEP for the runner.** Our `SimpleTable`/`PivotTable` carry heavy, recent, hard-won investment (AR-15/27/34/35: pivot align, sticky freeze, bounded scroll, sr-only a11y table) tightly coupled to `DataRow`/`encoding`/OLAP-pivot semantics. TanStack Table's column/row model does not natively express our pivot; adopting it would *fight* that investment. **Only** consider TanStack Table (+ Virtual) for a future **panel** big-list surface (catalog/member browser), consumer-gated. **Confidence high** for the reject; the panel-list use is YAGNI.

---

## 4. Form / schema-driven rendering — react-hook-form / TanStack Form / JSON-Forms / Autoform vs PropSchema Inspector

**Current:** generic Inspector renders fields from `PropSchema` (which carries `DataSpec`, `ChartDef`, `enum-ref` sources); `describeApp()` emits `page-config.schema.json` as the external JSON-Schema contract.

**Verdict: REJECT-KEEP (strongly). Keep emitting JSON Schema at the boundary.**

- **Reason.** Our `PropSchema` is a **richer, domain-aware** schema-driven renderer than JSON Forms / RJSF — it carries data-binding, chart grammar, and `enum-ref` capability sources those engines have no concept of. Adopting JSON Forms would be **adopting a weaker version of what we already built** — a downgrade that fails *strengthen*.
- **react-hook-form / TanStack Form solve a different problem** (form *state* for hand-built JSX forms: registration, dirty, validation), not schema-driven *rendering*. Our Inspector generates fields from a schema; RHF's ergonomics are for JSX forms. Under-the-hood field-state gain is marginal — the Inspector's field state is simple. Not worth a paradigm dep.
- **The right standard adoption is already in place:** keep the **JSON-Schema bridge** (`describeApp()` → `page-config.schema.json`) for external validation/tooling (JSON Forms / Ajv / RJSF interop) — that is the contract-first, capability-discoverable win, without importing their runtime.
- **Arrow:** n/a (no change). **Confidence high.**

---

## 5. Canvas / visual-editing — tldraw / react-flow / Craft.js / Puck / dnd-kit

**Current:** our canvas (typed JSON tree + `NodeSliceMeta`/`PropSchema` registry + `render(config)` purity) on **dnd-kit** primitives. Prior ruling: keep-our-canvas + borrow-Puck-ergonomics.

**Verdict: REJECT-KEEP the canvas · KEEP dnd-kit · BORROW Puck ergonomics (reconfirmed) · NEW: flag react-flow for a future lineage/model-graph surface only.**

- **Puck** is the closest external match to our own model (typed JSON tree + `fields` schema + `render(config)` purity) — which is *exactly why adopting it is wrong*: it would mean **bending our schema to theirs**, breaking Config = SSOT. **Borrow the ergonomics** (drop-zone UX, inline-edit affordances, field-panel patterns), not the library. Reconfirmed.
- **Craft.js / GrapesJS — REJECT** (freeform ungoverned HTML — the counter-example to statistics-grade governance). **tldraw — REJECT** (infinite whiteboard; wrong model — freeform drawing, not governed blocks).
- **dnd-kit — KEEP.** Correct *level*: a low-level drag primitive, not an opinionated editor. Right call.
- **react-flow — NEW flag.** Wrong shape for the *authoring* canvas (a dashboard is a document, not a node-graph). **But** the eventual **lineage / model-graph** surfaces (AR-41 reactive dataflow · AR-43 lineage · AR-49-M2 Model mode) — metric → derives → surfaces as a DAG — are exactly react-flow's domain. **Consumer-gated:** candidate for *that* surface if/when it is built, never for the authoring canvas.
- **Arrow:** apps-only. **Confidence high.**

---

## 6. Testing / e2e — formalize Playwright

**Current:** **no Playwright dependency anywhere** (`grep` of every `package.json` = 0). It is run **ad hoc** via loose probe scripts (`work/probe-sna-table.mjs`, `work/probe-*.mjs`). axe-core is a devDep but not wired into any browser run. Vitest + Testing Library + MSW cover unit/integration.

**Verdict: ADOPT — the single highest-value, lowest-risk adoption on this list.**

- **Reason — it closes our most painful recurring gap.** The registry is littered with "**REAL-BROWSER verify pending**" and "**green ≠ works**" / live-boot notes (M1: "deploy-time live-verification pending"; AR-8/13/14/15/27/34/35 all end in a manual real-browser TODO). Our own status vocabulary makes **VERIFIED** *require* server real-browser proof — yet we have **no committed harness** to produce it; we re-write throwaway Playwright probes each time.
- **What it adds.** Playwright as a **committed devDependency** + a checked-in config + a small, durable e2e suite: **(1) boot smoke** (app → `/api/bootstrap` → populated palette / rendered page, the M0/M1-class ordering bug), **(2) render-parity / permalink round-trip** (URL = state, Law 9; `ViewSnapshot` round-trip), **(3) theme/locale repaint** (AR-13/14/37 flip-and-verify). This turns the manual VERIFIED gate into a **fitness function** — the thing the whole registry keeps deferring becomes automated.
- **a11y bonus (Law 9):** wire the existing `axe-core` devDep via **`@axe-core/playwright`** into the suite → automated WCAG 2.1 AA gate. Near-zero added cost, high governance value.
- **Cost/risk.** Low: **devDependency + apps-level config only**, no runtime change, **no arrow impact**. Formalizes what we already do by hand.
- **The test:** *strengthen AND simplify?* **Both.** Strengthens (real-browser truth as a gate) and simplifies (retires the throwaway-probe churn into one maintained harness).
- **Confidence high.** **[verify against current release]** current Playwright version + config conventions + `@axe-core/playwright` compatibility.

---

## 7. Anything else genuinely worth it

- **`@axe-core/playwright` — ADOPT (with §6).** Turns the dormant `axe-core` devDep into an automated a11y gate. Highest-leverage add-on to the Playwright adoption.
- **TanStack Virtual — BORROW / DEFER.** For large tables/member lists (perf + a11y). Today tables wrap+scroll adequately; **consumer-gated** — adopt only when a genuinely large table/list appears. Pairs with the (also deferred) TanStack Table panel-list case.
- **Semantic-layer tooling (Cube / Malloy) — REJECT-KEEP-ours.** Already ruled: **grow AR-40, refuse the runtimes** — both assume a SQL warehouse, breaking **Law 5** (`fromSDMX` sole boundary) and reintroducing a query language into config (**Law 2**). `MetricDef` stays a thin declarative leaf (`FF-METRIC-THIN`). Confirmed.
- **i18n tooling — REJECT-KEEP-ours.** i18next (23) + our `LocaleString` content-resolve seam (AR-26/37) is **reference-grade** per the benchmark corpus. Optional dev-only: `i18next-parser` for key extraction (ergonomics, not architecture) — minor, non-committing.
- **Validation — no change.** Ajv (JSON-Schema config contract) + zod (api DTOs) is a reasonable split; consolidating is not worth the churn.
- **Storybook — REJECT for now.** `describeApp()` + the palette is our *single* capability-discovery SSOT; a parallel Storybook catalog risks drift. Revisit only if a real design-review workflow demands it.

---

## 8. Ranked shortlist (value × low-risk)

### TOP adoptions actually worth doing
1. **Playwright (+ `@axe-core/playwright`) — ADOPT NOW.** Highest value, lowest risk. Committed devDep + e2e config + boot-smoke / permalink / theme-locale / a11y suite. Makes the **VERIFIED** gate an automated fitness function; retires throwaway probe churn. Arrow-clean (apps/devDep). **[verify current release]**
2. **TanStack Query (panel authoring server-state ONLY) — ADOPT-CANDIDATE after a spike.** Could simplify panel fetch/save + dull the stale-cache bug-class (AR-41). Must *displace* api-actions, not coexist. Does **not** touch `DataStore`. Arrow-clean (apps/panel). Medium confidence — **spike + [verify v5] before commit.**

### Borrow the idea, not the library
- **Vega-Lite grammar → `ChartDef` convergence** (keep ApexCharts as the default renderer strategy; ECharts as a consumer-gated 2nd strategy). Law 4 = adopt the *grammar* whole, not the runtime.
- **Puck ergonomics → our canvas** (never the lib — it would break Config = SSOT). Reconfirmed.
- **Radix / React Aria (headless) + our tokens → Strangler-migrate the panel off MUI**, gated on the Studio-shell build. Direction confirmed; **not** a big-bang. **[verify Radix vs Ark vs React Aria a11y]**
- **react-flow → future lineage / model-graph surface only** (AR-41/43/49-M2), never the authoring canvas.
- **TanStack Virtual / Table → future panel big-list surface only** (consumer-gated).

### Where "keep + build our own" genuinely wins (proven, not assumed)
- **PropSchema Inspector** over JSON Forms / RJSF / RHF — ours is *richer* (carries `DataSpec`/`ChartDef`/`enum-ref`); external = a downgrade. Keep the JSON-Schema *bridge* for interop.
- **Our canvas** over Craft.js / tldraw / Puck-the-lib — governed blocks + Config = SSOT beat freeform/foreign-schema.
- **Zustand** over RTK / Jotai; **react-router 6** over TanStack Router — right-sized, no win in switching.
- **`DataStore`/`CachedStore`** over TanStack Query for the **runner/OLAP** layer — a domain observation store, not an HTTP cache.
- **Semantic layer (AR-40)** over Cube / Malloy runtime — Law 5 / Law 2.
- **`LocaleString` i18n seam · DTCG tokens · expr sandbox · schema versioning** — independently benchmark-graded reference-grade; nothing external improves them.

**The honest bottom line:** the instinct to build-our-own was *correct* everywhere it touched the config grammar, the inspector, the canvas, the semantic layer, the tables, the tokens, and i18n — because in each case the external library is weaker or breaks a Law, and this doc proves that axis-by-axis. The **one place we genuinely under-adopted is testing** — Playwright, which we have been doing by hand — and, more tentatively, **panel server-state** (TanStack Query, pending a spike). Those two are the real gap. Adopting Playwright is the highest-value move on the board.
