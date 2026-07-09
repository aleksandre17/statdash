# Forward Vision — North Star (orchestrator synthesis)

> **Author:** orchestrator (lead). **Date:** 2026-07-09. **Purpose:** the owner asked, before we descend into UI/detail polish ("the kitchen"), for the COMPLETE remaining vision — ideas, innovations, logistics, concepts, architectures, packages — laid out fully. This is that synthesis: what the platform *is becoming*, in what order, and the honest line between vision and proof.
> Grounded in: `HUNT-future-vantage.md` (2026-07-01 capability audit), the AR-49 arc (M0–M3.0, live-verified on staging), `EVAL-package-landscape.md`, and the `ARCHITECTURE-REGISTRY`. Not a backlog — a trajectory.

---

## 0. Where we stand (honest snapshot, 2026-07-09)

- **The authoring reconception (AR-49) is built and live-verified on staging** (data/persistence layer, prod untouched): metric-first Governed Canvas (M0), The Studio shell replacing the wizard (M1), Model mode + Steward role + in-tool metric & calc authoring (M2, M3.0). ~30 commits on `feat/ar49-m0-metric-first-authoring`, 2800+ tests, 4 QC passes, arrow untouched.
- **The platform beneath is ~80% built and fitness-locked** (per HUNT-future-vantage): config-is-data, registry-everywhere, boundary-scope for locale/perspective/tenant, open ports for serialize/rules/query, cross-filter runtime, provenance/ingestion.
- **What is NOT yet true:** the live *UI* is not fully browser-verified (the owner's own eyes just found a font-contrast defect + a Model-mode discoverability gap — the "kitchen"); nothing is merged to main; "better than competitors" is a reasoned architectural claim, not an empirical benchmark; non-programmer usability is un-user-tested; multi-tenancy is a preserved seam, not a build.

**The thesis, restated:** the hard neutral work is done. The forward job is three things — (A) **finish the authoring moat** so a non-programmer can compose and a steward can model 100% of what the runner renders; (B) **lay the one identity keystone** everything compounds on (AgencyScheme); (C) **hold YAGNI** so the six reserved ports stay open until a real consumer walks through. A seam held open cheaply is worth more than a capability built early and unused.

---

## 1. Finish the authoring vision (AR-49 remaining) — near-term, mostly decided

- **M3.1 — Metric Recipes** (apps-only): a "Show Me for metrics" gallery — the recipe supplies the algebra, the steward fills a blank → a first-class governed metric. The calc editor (M3.0) is the atom; recipes are pre-filled instances. *This is the single biggest lift toward "a non-programmer touches the data side."*
- **M3.2 — Growth as a governed noun** (the ONE engine change: a relative-time coordinate in `MetricInput.at` + `@statdash/expr` + wire). Gated one-way-door — off the critical path.
- **M3.3 — Dimension curation editor** (thin; the "define" side for dimensions).
- **M3.4 — Kinder-expert T3**: make the raw pipeline surface (query/pivot/transform) *gentler* with plain-language labels/help — never non-programmer, but humane. Honesty-preserving.
- **The honesty boundary as product doctrine** — *derive meaning from governed data = non-programmer; define what raw data IS (SDMX/DSD ingestion, cube-profile, row-shaping) = stays expert.* Bless it so we never overpromise.
- **The kitchen (discoverability + polish)** — the live-UI issues the owner is finding (their eyes are the current instrument; the Studio UI was never browser-verified). This is where "good" becomes "used." Concrete, already found:
  - **TOP kitchen item — MUI theme bound to DTCG tokens (ADR-worthy, held for owner).** The panel has NO MUI `ThemeProvider`/`createTheme` — every MUI control (⌘K, Model toggle, locale, selects, page chip) renders on MUI's default bright blue `#1976d2`, clashing hard with Strata's deep azure/navy. This is the *bulk* of "terrible font colors" and token DATA cannot reach it. Fix = a MUI theme via **CSS-variables theming (`extendTheme`/`CssVarsProvider`)**, NOT naive `var()`-in-palette (MUI's `alpha()/decomposeColor()` throws on a `var()` string). Affects the whole panel look → ADR + owner in the loop.
  - **Model-mode / role-toggle discoverability** — the owner couldn't find metric authoring (it's behind the steward lens by design); if the concept's author can't find it, no user will. Make the role toggle + Model entry obvious (likely worsened by the contrast/blue clash hiding the top bar).
  - **Strata text identity** — DONE (foreground-token cohesion + FF-STRATA-CONTRAST guard).
  - **FF-CHROME-TOKEN-DRIVEN is toothless** — vitest returns empty for CSS `?raw`, so its file scan is vacuous (a planted brand literal wouldn't be caught). Rework to read sources safely. Follow-up.
  - **Real-browser e2e over the whole Studio** on staging — replace the owner's eyes with a Playwright pass (alpine-chrome in the deploy env couldn't render; run it against the served staging panel).

## 2. The platform capability roadmap (the compounding order)

Ranked by (future-need × compounding-leverage ÷ effort); YAGNI-disciplined.

1. **AgencyScheme identity SSOT — BUILD NOW (keystone).** `agency` is named everywhere and stored nowhere (free-text on V27/V29/V31 + `dataset.source`). Model `stats.agency(id, code, name-i18n, parent)` + repoint by expand-contract. Justified by a *today* consumer (the unmodeled SSOT), and — via FK indirection — it keeps the multi-tenancy door open **without building MT** (Protected Variations: "is agency also a tenant?" sits behind a stable FK). Cheapest now, most expensive to retrofit late.
2. **Authoring parity + cross-filter authoring.** The Studio's generic PropSchema Inspector already advanced Seam-2 (schema-driven editors). The live gap is **Seam-3**: the cross-filter/drill *runtime* is built (`links/resolver.ts`, `crossFilter.test.ts`, `useChartInteractions.ts`) but has **no authoring surface** — a shipped capability invisible to the Constructor. Expose it: a `DataLinkDef` PropSchema-driven editor. This is the **Grammar of Interaction** — dashboards where selecting in one chart filters the canvas — a genuine differentiator, already half-built.
3. **Perspective Lattice — build WITH a vintage/revision consumer.** The generic `perspectiveState: Record<param,string>` spine is clean and load-bearing. Vintage/revision, geo-mode, seasonal-adjustment, unit-basis all become *axes*; their product is addressable permalink state with zero new machinery. Justify it with **vintage comparison** ("GDP as published 2024-Q3 vs latest" — the provenance data exists), not speculatively.
4. **Reserved ports stay open (YAGNI).** SDMX-REST serve + serializers (json-only today, 6 reserved), VTL/RuleSpec engine, sub-annual grain, ESMS/SIMS metadata tree. Each is a bounded additive registration the day a consumer arrives. *Do not build early.* The maturity is proven by how many capabilities sit correctly behind open seams, un-built.

## 3. Mission / delivery layer (AR-48) — a public-statistics platform is judged on this

Export / embed / permalink / snapshot over one `ViewSnapshot` SSOT. ~80% built (data export CSV/XLSX/SDMX-JSON live; snapshot serialization + persistence + embed mint/read routes exist but UNCONSUMED). Real work: name the port, wire the built-but-dark embed/snapshot backend to the client, and complete 3 facets — **image export** (PNG/SVG), **provenance-on-export** (methodology footer/caption), **card-scoping** (single-card iframe). A national-stats platform lives or dies on embed/citation/export; today it's a dark backend seam.

## 4. My innovations — the genuinely-new frontier (beyond the registered roadmap)

These are the moves I'd champion as ideologue — each rides seams that already exist:

1. **AI / natural-language authoring.** The metric-first semantic layer makes this *uniquely* tractable: governed nouns (metric × dimension × perspective) are a clean, safe target for "show me GDP per capita by region over time" → a governed config, not free-form codegen. Nobody else has a governed-noun vocabulary to lower NL onto. This is the true "non-programmer pipeline" endgame — and it's *more* honest than a chat box because it emits reviewable governed config, not opaque SQL. Frontier, high-differentiation.
2. **Data lineage / provenance surface.** Every governed number traces to its SDMX source + methodology + vintage — "why is this number what it is." Statistics-grade trust made visible; the completion of the "one governed number on every surface" promise. Rides the provenance data (V25/V31) already in the DB.
3. **Narrative / annotation layer.** Analytical commentary bound to data ("GDP grew 5.2%, driven by…") — governed, bilingual, versioned with the release. A statistical agency publishes *analysis*, not just charts. Turns dashboards into releases.
4. **Publishing / release workflow.** Draft → review → publish, with embargo + a release calendar. `page-workflow` (AR-47) partially exists. Statistical offices have formal, dated releases — this is table-stakes for the real institutional buyer.
5. **Multi-agency productization.** The `tenant_id` seam is preserved; AgencyScheme (S1) is the FK that turns it real. The business frontier: one platform, many statistical agencies — each authoring its own governed catalog through The Studio.

## 5. Logistics — the sequence to a complete product

- **Close the kitchen first** (contrast, discoverability, real-browser e2e over the Studio). The live-UI is the last unproven surface; the owner's eyes are the current instrument — replace them with a Playwright pass on staging.
- **Merge discipline.** The AR-49 branch is large and live-verified; it needs a clean merge to `main` + a prod deploy plan (api image rebuild no-cache — provisioning is baked in). Prod is a LAN demo (:3002/:3003) — deploy deliberately, backup-first, per-service.
- **Then the compounding order:** AgencyScheme keystone → authoring parity + cross-filter authoring → Perspective Lattice (with vintage) → mission delivery (AR-48) → the innovation frontier (NL authoring, lineage, narrative, publishing).
- **Package convergence** (below) folded in where it strengthens *and* simplifies, never as churn.

## 6. Architecture end-state (the invariants we protect)

- **Config is the SSOT; the Constructor generates 100% of it, no code** (Phase-2 goal — largely realized by The Studio). Every capability that ships in the runner must be authorable in the palette (Seam-2/3 as an *invariant*, not a chore).
- **The semantic layer is the spine** — one governed definition, one `resolveMeasureRef` path, "one number everywhere." Grow AR-40; refuse Cube/Malloy-as-runtime (Law 5).
- **The dependency arrow never bends** (`contracts ← expr ← core ← charts ← react ← plugins ← apps`); `packages/react` stays app-agnostic. Proven: M1+M2+M3.0 touched *zero* packages.
- **Seams-open + YAGNI as doctrine** — six ports held open, un-built, awaiting real consumers. Maturity = restraint.
- **Boundary-scope for the variation points** (locale, perspective, tenant/agency) behind stable FKs/records — Protected Variations, so the expensive future decisions stay swappable.

## 7. Packages — additional adoptions (from the eval, honest)

- **Playwright + axe — ADOPTED.** The standing real-browser fitness gate (already caught 4 live-only defects). Activate `@axe-core/playwright` for the WCAG gate.
- **MUI → Radix/React Aria — a Strangler initiative, its own project.** Real (a headless, token-native chrome), but *during* not-a-shell-migration = churn. Do it deliberately, post-AR-49, insulated by the token layer.
- **Vega-Lite grammar — BORROW, don't adopt the lib.** Converge `ChartDef` toward a Grammar-of-Graphics spec with ApexCharts as one renderer strategy (Law 4 adopts standards whole). ECharts as a consumer-gated 2nd strategy.
- **TanStack Query — DEFERRED spike.** Only when the panel's api-actions/data layer is next touched anyway; must replace, not sit beside; never touch DataStore.
- **Everything else — keep-our-own (earned).** The config grammar, PropSchema Inspector, canvas, semantic layer, stat-tables, DTCG tokens, i18n each beat the external lib or the lib breaks a law. Subtraction was right.
- **The one net-new to watch:** an **NL/AI authoring** layer (innovation #1) — a genuinely new dependency class (an LLM gateway), justified only by the governed-noun target that makes it safe. Design before adopting.

## 8. Honest risks / not-done (the line between vision and proof)

- **Live UI unverified end-to-end** — the kitchen. Font contrast + Model-mode discoverability already found by the owner's eyes; more likely lurks. *Highest-priority next.*
- **"Better than competitors" is architectural, not empirical** — no live product benchmark (no web research access); no non-programmer usability test. Both are real gaps, not spin.
- **Nothing merged; prod unverified** — the whole arc is a branch, live-verified only on the isolated staging twin.
- **Multi-tenancy is a seam, not a build** — deliberately; AgencyScheme is the honest half-step that keeps it open.
- **Deferred authoring pieces** — recipes (M3.1), growth-as-noun (M3.2), dimension authoring (M3.3), cross-filter authoring (Seam-3), the export/embed client (AR-48).

## 9. The one-page thesis

We set out to reconceive authoring and we did: the wizard is gone, replaced by a metric-first Studio built from the best of the market's visions and organized to occupy the one quadrant none of them hold — *statistics-grade AND non-programmer-authorable* — canonically, on an unbent arrow, additively, fitness-locked. The remaining vision is not "more features." It is: **finish the moat** (recipes, cross-filter authoring, the honesty boundary), **lay the one keystone** (AgencyScheme), **close the kitchen** (make the live UI as good as the architecture), **light the dark mission seam** (export/embed/citation), and then **walk through the frontier we're uniquely positioned for** (NL authoring onto governed nouns, lineage, narrative, publishing, multi-agency). Hold YAGNI on the six open ports. Prove "better" empirically and with real users. The architecture is alive, not frozen — and it is ready for every one of these without bending.
