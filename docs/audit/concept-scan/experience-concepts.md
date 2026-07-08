# Experience-Concept Mining — authoring / visualization / interaction / UX / a11y (INDEX)

> Senior frontend-architect concept scan. Doctrine: **MAXIMAL adoption** — if a concept strengthens the
> platform we adopt it FULLY (every layer, nothing unused). Mandate: mine the best BI / visual-builder /
> interaction / a11y platforms for concepts our Constructor + renderer **LACK**, and for each propose a
> full every-layer adoption plan riding a *shipped seam*. **Analysis only — no product code changed.**
> Branch `feat/tenant-agnostic-platform` (HEAD `f316001`). Date 2026-06-28. Author: senior-frontend (Opus).
> Canon: WCAG 2.1 AA · WAI-ARIA/APG · SoC · OCP/registry · SSOT · §12 declarative/config-driven.

## Card files (one cluster per file — `05`/`09` hygiene)
- [§1 Interaction layer (the named gap)](experience-concepts-interaction.md) — EXP-01..05
- [§2/§3 Citizen authoring + a11y leaders](experience-concepts-authoring-a11y.md) — EXP-06..10
- [§4 Publication / narrative](experience-concepts-publication.md) — EXP-11..13

Each card: What it is / Does it strengthen US? (honest verdict) / Fit (which shipped seam) / FULL-adoption
plan every layer (engine→react→charts→plugins→panel→api) + the fitness that PROVES adoption / Effort · door ·
Class(M/G) · priority / Raises-the-bar.

---

## 0. Grounding — what we ALREADY have (so every card is genuinely NEW)

Verified in source, not docs. Off the table as "new":

- **Authoring** — schema-driven generic Inspector + `FieldControlRegistry` over a `SchemaSource` port (6
  surfaces, 1 renderer); capability-gated palette; flat⇄tree **byte-identical** round-trip; live in-process
  WYSIWYG canvas (real engine); field-wells + Show-Me; Outline + Cmd-K/slash (one insert path, 4 surfaces,
  byte-identical); templates + data-first generate; Perspectives pane.
- **Coverage gate** — `coverage.fitness.test.ts` enumerates **5 capability axes from engine SSOT** (transform
  ops · DataSpec types · ParamDef types · VisibilityExpr ops · perspective scope keys), proving each is
  authorable or an explicit shrinking TODO. *It does NOT enumerate the interaction action union* — the seam
  this scan exploits.
- **Render** — neutral `ChartOutput` + ApexCharts adapter (13 interpreters); 4-tier semantic-token spine;
  runtime-zero variant spine; capability-nav; container-query layout; LocaleString i18n.
- **View algebra** — **perspectiveState** `Record<param, activeId>` Harel orthogonal-regions container
  (`core/src/config/perspective-state.ts`), permalink-from-registry, registry-driven scope keys (OCP).
  `perspective = f(URL state)`, not a captured snapshot — already **beats** PowerBI bookmarks / Grafana
  variables / Tableau parameters on orthogonality.
- **⚠️ Interaction substrate EXISTS BUT IS THIN (N36)** — `NodeBase.on?: NodeEventHandler[]`
  (`react/src/engine/types/node.ts:125`), `NodeAction` union, a typed `PlatformEventMap` EventBus
  (`row:hover|row:click|legend:toggle|drill:down|perspective:change|node:status`), and `DataLinkDef`
  (`core/src/links/types.ts`). **The *event* catalogue is rich; the *action* catalogue is one member** —
  `NodeAction = FilterAction` only (`react/src/engine/node-events.ts:25`). `DataLinkDef.target` =
  `filter|page|url|external`. **Crucially `node.on[]` is engine-consumed but (a) NOT authorable — zero refs
  in `apps/panel/src` — and (b) NOT in the coverage gate.** A shipped-but-empty OCP union on a shipped
  EventBus + perspectiveState writer, with no authoring surface: the single most leverage-rich seam here.

The brief's hypothesis is **confirmed**: render is strong; the interaction layer is a shipped skeleton with
one muscle, and citizen-grade authoring of it does not exist. Our **perspectiveState view-algebra + the empty
`NodeAction` union + the EventBus** are exactly the seam that makes cross-filter / actions / parameters cheap.

---

## 1. RANKED ADOPTION TABLE (strengthen-most × cheapest-for-us first)

| Rank | Concept | Strengthens | Rides shipped seam | Effort | Door | Class | Pri |
|---|---|---|---|---|---|---|---|
| 1 | **EXP-01 Dashboard Actions (full `NodeAction` union + authoring + coverage axis)** | MOST | empty `NodeAction` union + EventBus + perspectiveState + permalink | M/L | two-way | G | **P1** |
| 2 | **EXP-09 APG interaction-pattern registry + reduced-motion token** | MOST (integrity) | plugin registry + RX-24 gate pattern + token spine | L | two-way | G | **P1** |
| 3 | **EXP-06 Value mappings → {text, token, icon}** | HIGH | neutral output + token spine + `$cl/$d` pipe + Inspector | M | two-way | G | P2 |
| 4 | **EXP-02 Cross-highlight (dim, don't filter)** | HIGH | EventBus `row:hover` + variant spine + EXP-01 union | S/M | two-way | M | P2 |
| 5 | **EXP-04 Field parameters (reader-swappable measure/dim)** | HIGH | perspectiveState axis + field-wells `binding` + ParamDef registry | M | two-way | G | P2 |
| 6 | **EXP-11 Story points (guided perspective tour)** | HIGH (publication) | perspectiveState + permalink (near-zero new) | S/M | two-way | M | P3→P2 |
| 7 | **EXP-05 What-if / scenario parameters → derive** | HIGH (domain) | `packages/expr` + derive op + `$param` ref + perspectiveState | M/L | two-way | G | P2 |
| 8 | **EXP-03 Drill (in-place + drill-through)** | HIGH (domain) | classifier LTREE + perspectiveState axis + `DataLinkDef` | M/L | one-way-ish | M | P2 |
| 9 | **EXP-12 Annotations & threshold-bands (authorable)** | MED (complete existing) | `AnnotationOutput` + token spine + `$ref` + Inspector | M | two-way | M | P3 |
| 10 | **EXP-07 Library / reusable components ("instances")** | HIGH (governance) | flat store + round-trip + insert path + migration runner | L | one-way-ish | G | P2 (escalate) |
| 11 | **EXP-10 Smart-narrative twin (deterministic)** | MED (a11y synergy) | neutral output + JSON walker + LocaleString + methodology | M | two-way | M | P3 |
| 12 | **EXP-08 Responsive per-breakpoint overrides + device frames** | MED | variant spine + container-query layout + canvas | M/L | two-way | G | P2/P3 |
| 13 | **EXP-13 Explore mode (config-generating)** | MARGINAL | live-preview stores + field-wells + generate | M | two-way | M | P3 (gated) |

---

## 2. TOP-3 "ADOPT-FULLY-NEXT"

1. **EXP-01 — Dashboard Actions: complete the `NodeAction` union (P1, crown).** The single highest-leverage
   move in the codebase: a shipped-but-empty OCP union (`NodeAction = filter` only), sitting on a shipped
   EventBus and a shipped perspectiveState/permalink writer, with **no authoring surface and no coverage
   axis**. Closing it turns "renderer" into "interactive dashboard," costs assembly not invention, and the
   fitness is a 6th coverage axis identical to the 5 we already trust. *This is the interaction layer the
   brief predicted we lack — and our perspectiveState view-algebra is precisely why it's cheap.* Land
   filter+highlight+set-perspective+drill+url+set-param as the union; EXP-02/03/04/05/11 then ride it.

2. **EXP-09 — APG interaction-pattern registry + reduced-motion (P1, integrity).** Our Law-9/WCAG-AA claim is
   unverified at the real shell layer (perspective-bar keyboard-broken, no reduced-motion, zero axe gates on
   real shells). Adopt it *architecturally*: each shell declares its APG pattern; a fitness cloned from RX-24
   walks the real plugin registry and proves the keyboard contract + axe. The only TOP-3 item that is also a
   launch-blocker for a public-sector platform.

3. **EXP-06 — Value mappings (P2, cheapest big win).** Pure config, rides the neutral output + the
   tenant-overridable semantic-token spine + the existing `$cl/$d` display pipe. Closes the most common
   citizen-grade presentation gap (status/label/color semantics) with a declarative, token-bound, a11y-safe
   layer; the no-literal-color fitness extends discipline we already enforce.

**Why these three:** they cover the two named gaps (interaction + citizen authoring) plus the integrity
floor, each rides a seam shipped *already*, and each ships as a **shrinking-list fitness** so adoption is
CI-visible — the same evolutionary-architecture move (skill §5/§12) the platform already trusts.

**Note on the seam:** cross-filtering / dashboard-actions / parameters ARE the interaction layer we lack —
and our **perspectiveState view-algebra is the seam that makes them cheap**. Drill, field-params, scenario
params and story points all reduce to "another orthogonal axis in the Perspective Lattice," so they compose
and become permalink-shareable for free — the property no incumbent (Power BI/Tableau/Grafana) gives, because
none has an orthogonal, URL-addressable view-algebra to hang them on.

---

## 3. SKIP LIST (incumbent cruft or already-owned — one line each)

- **Component variants (Figma)** — HAVE: runtime-zero variant spine (`styles/src/resolvers/variant.ts`).
- **Code-component registration + visual props (Plasmic / Builder `registerComponent`)** — HAVE:
  `nodeRegistry` + `PropSchema` + generic Inspector, with a *closed coverage proof* they lack.
- **Bookmarks (Power BI)** — HAVE BETTER: perspectives are `f(URL state)`, derived not captured.
- **Resource / query model (Retool / Appsmith)** — HAVE: `DataStore` port + `fromSDMX` adapter boundary.
- **Show-Me as a model (Tableau)** — HAVE: `showme/` + `suggestPanels` recommender.
- **Auto-layout (Figma)** — HAVE: container-query layout + stack/grid/columns nodes.
- **Blends / data-blending UI (Looker / Tableau)** — HAVE the seam: `blend` transform op (B0); adoption, not
  a new concept.
- **LookML semantic governance / calculated fields as governed objects (Looker / Tableau)** — HAVE the seam:
  `MetricDef`/semantic layer is built (ENG-05) — *adopt the existing cathedral* (X-2), don't import a new model.
- **Reactive notebook / inputs-as-cells (Observable)** — SKIP: paradigm mismatch; perspectiveState is already
  reactive and governed-config is our moat.
- **Modeling view / relationship canvas (Power BI)** — SKIP for now: model lives in SDMX/DSD + cube profile;
  YAGNI until multi-cube authoring is real (rides X-1).
- **Iframe canvas for style isolation (Builder.io)** — SKIP: deliberately rejected; in-process render is
  higher-fidelity, lower-latency (CON-05 already beats this).
- **RBAC-on-components (Retool)** — DEFER: real need but gated on the multi-tenancy decision (X-1).
- **Alerting (Grafana)** — SKIP: operational-monitoring concern, out of scope for a dissemination platform.

---

*File/line citations verified against branch `feat/tenant-agnostic-platform` (HEAD `f316001`). Load-bearing
facts spot-checked in source: `NodeAction = FilterAction` only (`packages/react/src/engine/node-events.ts:25`);
`node.on[]` on `NodeBase` (`react/src/engine/types/node.ts:125`) but absent from `apps/panel/src`
(un-authorable) and from the coverage gate's 5 axes (`coverage.fitness.test.ts`); `DataLinkDef.target =
filter|page|url|external` (`core/src/links/types.ts`); perspectiveState SSOT
(`core/src/config/perspective-state.ts`).*
