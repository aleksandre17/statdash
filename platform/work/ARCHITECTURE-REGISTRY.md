# Architecture & Vision Registry — statdash-platform

> **SSOT for every high-concept architecture/vision we commit to. Nothing here is lost.**
> The lead MAINTAINS this: every architectural vision the owner raises gets a card HERE, with its design doc + status + next action, **before we move on to anything else.** Depth lives in the linked `work/DESIGN-*.md` / ADRs / agent memories — this is the index that guarantees nothing falls through.
>
> **Status vocabulary:** `VISION` (raised, not yet designed) · `DESIGNED` (doc + phased plan exist) · `BUILDING` · `BUILT` (green, unit-verified) · `VERIFIED` (server real-browser / real-DB proven) · `DEFERRED` (owner decision) · `SUPERSEDED`.
> _Last curated: 2026-07-01 (lead)._

---

## A. Responsive · Composition · Style (the current thrust — owner's #1)

> **Governing standard (owner, 2026-07-01): MAXIMUM, not minimum.** The layout system harnesses the FULL power of CSS Grid + Flexbox, exposed as a **JSON grammar of layout**, interpreted by the JS renderer, container-query-driven, per-breakpoint — at the grade of the strongest frameworks/platforms (Builder.io/Plasmic/Framer/Vega/Grid+Flex), with their patterns (registry/OCP, interpreter, responsive-value, composite, design-tokens). Maximum **agnosticism · dynamics · functionality · architecture · concept**, while staying compatible with the existing configs + services (config-is-data, rides NodeStyles/ResponsiveValue/DataStore seams). **The ARCHITECTURE is always maximal + framework-grade; capabilities are activated progressively per real need (YAGNI on population, never on the seams).**

| ID | Architecture / Vision | Concept (1-line) | Design | Status | Next |
|----|----------------------|------------------|--------|--------|------|
| **AR-1** | **Grammar of composition** | structure (layout nodes) + style (NodeStyles) = two axes of one node, resolved by `resolveStyle`+`@layer` cascade; kills the specificity fight | `DESIGN-responsive-composition.md` | DESIGNED · foundation BUILDING (a38b) | build P0 @layer + P1 resolveStyle |
| **AR-2** | **Layout-node adoption / section-uniformity** | sections/pages compose via `nodes/layout` (one primitive), retire bespoke divs, kill duplicate `row` grid, wire `align` | ↑ | **VERIFIED** (server `:3008` — uniform composition, equal-height, gdp nav populated, map definite height) | — |
| **AR-3** | **Declarative FILL contract** | inner element fills parent body height via config (`fill`→flex `1 1 0`+`min-height:0`+`height:100%`+chart `height:'100%'`); composable with inner-overrides-outer | (folding into AR-1/2) | **BUILT (`84999e2`)** — leaf growable-band + Apex `parentHeightOffset:0` + unbroken chain to Apex mount; fitness-locked (frozen-176 can't regress) | server re-verify chart-fill |
| **AR-4** | **Framework-grade universal style system** | `NodeStyles` = Chakra/Theme-UI `sx` responsive style-prop; +token-constrained (DTCG) +named PARTS (`data-part`, style any inner tag) +Constructor `StyleField` | `DESIGN-framework-grade-style-system.md` | DESIGNED | build S0+S1 (token-picker StyleField + surface view.styles) |
| **AR-5** | **Maximal JSON grammar of layout** | FULL CSS Grid power in JSON — `grid` node exposes `templateColumns/Rows/Areas` (`minmax`/`auto-fit`/`repeat`/`fr`/`min()`/named lines), `autoFlow/autoColumns/autoRows`, `columns` shorthand, `gap`, `align`/`justify`; template props are `ResponsiveVal`, container-query-driven via the shared var+flag cascade (`resolveGrid` + `layout.css` `@container`); per-child `colSpan/rowSpan/order` rides `LayoutItemProvider`. Schema Constructor-introspectable. First slice: 8 gdp+regional section groups migrated `columns`→`grid` (pairs reflow intrinsically via `repeat(auto-fit,minmax(min(100%,24rem),1fr))`). | `DESIGN-responsive-composition.md` §3 | **BUILT** (green: build:engine·typecheck·tsc panel·lint·check-laws·vitest 31 FF + 104 pkg; `resolveGrid`+`GridNode`/`GridShell`/`layout.css` + FF-GRID-MAXIMAL + FF-GRID-COMPOSITION) | server re-verify gdp+regional 360→3440 (reflow 2↔1); then breakpoint-tabbed StyleField authoring (AR-11) + populate templateAreas per real consumer |
| **AR-6** | **3-tier style-override cascade** | plugin-default responsive < config `styles` < inner-overrides-outer; ONE mechanism every node, `@layer` precedence (merge, not specificity fight) | `DESIGN-responsive-composition.md` §A | DESIGNED (part of AR-1) | rides AR-1 build |
| **AR-7** | **Named PARTS styling** | promote internal `styleKeys` → public `parts` manifest, emit `data-part`, `view.parts.<p>: NodeStyles` via same `applyNodeStyles` | `DESIGN-framework-grade-style-system.md` (S2) | DESIGNED | build mechanism; populate per real consumer |
| **AR-8** | **Panel sizing → CONTEXT-PROPORTIONAL height** | base (height on content box, definite map/chart height) VERIFIED. **ELEVATION (owner 2026-07-01):** a single `clamp(floor,fluid,cap)` is UNIFORM, not proportional — a SOLO panel must be TALLER than a PAIRED one (more space/focus); ratio must be DYNAMIC per layout context. Best concept: drive height from container-query (`cqi/cqh` — solo/wide container→taller, paired/narrow→shorter) + per-context aspect ratio, declarative | `AUDIT-BRIEF-styles-responsive.md` | base VERIFIED; **context-proportional = VISION** | build after grid-elevation (aaaba660) + chart-fill (ab4be4e) — touches the sizing model (`node-styles.css`/resolvers) they hold |

## B. Constructor · Authoring SSOT

| ID | Architecture / Vision | Concept | Design | Status | Next |
|----|----------------------|---------|--------|--------|------|
| **AR-10** | **Authoring ← engine schema SSOT** | Constructor consumes `describeApp()`/PropSchema, never forks; kills the DRY (showWhen/dot-path forks) | `DESIGN-authoring-schema-ssot.md` | P1 BUILT (`c1a635e`); P2/P3/P4 DESIGNED | build P2 saveGuard-describes, P3 chart fieldConfig, P4 dataLinks |
| **AR-11** | **Style authoring in Constructor** | `PropFieldType:'style'` StyleField (token-picker × responsive-tabs × part-selector) on the declared `enum-ref source:'tokens'` seam | `DESIGN-framework-grade-style-system.md` | DESIGNED | build with AR-4 |
| **AR-12** | **RX-16 one-map-node** | fold choropleth into `geograph`, delete `panels/map` stub, `capabilityGate` gates on `geo` cap (not type-sniff) | `DESIGN-map-consolidation.md` | DESIGNED | build (post section-uniformity) |

## C. Data · SDMX · Platform

| ID | Architecture / Vision | Concept | Design | Status | Next |
|----|----------------------|---------|--------|--------|------|
| **AR-20** | **AgencyScheme identity keystone** | `stats.agency_scheme`+`agency` SSOT, FK-indirection over free-text `agency` (DB-08); keeps MT door open w/o building MT | ADR `ADR-multi-tenancy.md` §3 | BUILT + DB-VERIFIED (V38 `70cf6b7`) | apply to prod after AR-21 |
| **AR-21** | **V33 fresh-DB ordering fix** | migrate→ingest→migrate boot contract so clean-room `compose up` is deterministic (V33 corrective needs ingest data) | (escalated to architect) | VISION (defect found on server) | architect design the boot-order contract |
| **AR-22** | **TM orthogonal axis (DimBinding)** | time-mode = one perspective axis; `DimBinding`/`Selection` discriminant; fused literal killed | (built) | BUILT (`be95880`); P-final DESIGNED | P-final (delete `timeBinding`, panel migrate) |
| **AR-23** | **Grain rollup (OLAP)** | `granularity`→`point-series.grain`; cross-grain blend + rollup-router | CLOSE-BOARD | G4 BUILT (`a195a79`, data-gated); G5/G6 VISION | build G5/G6 when sub-annual data exists |
| **AR-24** | **Fail-soft chrome** | empty-manifest → brand-free fallback + app-root error boundary (ADR-0028 restored) | (built) | BUILT (`ff748d8`); VERIFIED-in-wild (429 graceful) | visual polish on server |
| **AR-25** | **Choropleth + donut color** | value→color scale (quantile sequential ramp, token-derived, agnostic); donut categorical palette | (built) | BUILT (`f8d8204`) | server re-verify |

## D. Deferred / Crown (owner-gated or consumer-gated)

| ID | Architecture / Vision | Concept | Status | Gate |
|----|----------------------|---------|--------|------|
| **AR-30** | **Multi-tenancy SaaS (POOL)** | one `tenant_id`+RLS isolates 5 planes below the port; agency=tenant; surpass Grafana/Looker | DEFERRED (owner) | perfect single-tenant first; seam preserved — see orchestrator `project_mt_deferred.md` |
| **AR-31** | **Perspective Lattice (crown)** | N orthogonal axes → 2^N permalink views | VISION | build WITH a real 2nd consumer (vintage/revision toggle) or it's adoption-debt |
| **AR-32** | **`_geoMode` → declared axis** | promote underscore-private computed var to a declared perspective axis | VISION | after the lattice |
| **AR-33** | **SDMX DQAF + REST surface** | quality indicators + SDMX-REST serve on the open `?format=` seam | VISION | build additively per real consumer (not speculative) |

## Standing hunts (living inventories — mine these, don't re-discover)
- `HUNT-adoption.md` — built-but-under-adopted capabilities (AD-1…AD-6).
- `HUNT-antipatterns.md` — active anti-patterns/hardcodes/DRY (Root A/B/C — A+B+C addressed).
- `HUNT-future-vantage.md` — future capability roadmap + seams to open now.
- `HUNT-violations-inventory.md` — the vital-few violation inventory.

---

### Maintenance rule (binding on the lead)
1. Owner raises an architecture/vision → **add a card HERE immediately** (before moving on). No vision lives only in a chat message.
2. Every design doc / ADR produced → linked here with a status.
3. Status advances only on evidence (BUILT=green, VERIFIED=server-proven).
4. Consult this at session start + before routing UI/composition/platform work — it is the SSOT of committed architectures.
