# STUDY — Panel Assembly & Capability Underuse (composition-model lens)

> Owner circle-break signal: *"assembling an object is still hard for a non-expert; we're NOT
> leveraging the full functionality we already have resources for."* READ-ONLY diagnosis.
> Lens: authoring-UX **composition model** + capability-underuse, benchmarked vs reference class.
> A parallel architect owns the internal-coupling lens — not duplicated here.
> Author: platform-architect (Opus). 2026-07-19.

---

## Verdict (one line)

**Element parity is done; the COMPOSITION PRIMITIVE is missing.** Every dropped object is a *blank
shell* the author must then assemble by hunting through the inspector, and the richest capabilities
we already built (DataWorkbench, VisibilityBuilder, ⚡bind, thresholds) are reachable only by an
expert who knows where to escalate. The reference class all ship a **meaningful-default / composed
starting point** primitive that we lack. The minimal fix is a **Composed-Preset projection** over the
existing registry — it makes assembly a *pick-a-meaningful-whole* gesture AND becomes the vehicle that
turns the buried capabilities into the default surface of every dropped object.

---

## 1. The assembly gesture path today (walked, file-cited)

Assembling one bound element = **four disjoint gestures across three surfaces**, each with its own
mental model:

| # | Gesture | Surface | File:line | Non-expert friction |
|---|---------|---------|-----------|---------------------|
| 1 | **Insert** — drag an icon tile → drop on canvas | NodePalette (native HTML5 DnD) | `canvas/NodePalette.tsx:90-95` | Good surface: meta-driven, gated, "Recommended" section. BUT the tile inserts a **blank shell** — `defaultProps` do not exist (verified: registry meta carries label/icon/caps/category/requires only, no default config). The object lands *empty and unbound*. |
| 2 | **Discover the inspector** — click the frame | CanvasOverlay → Inspector | `inspector/Inspector.tsx:1-34` | Schema-driven, plane-filtered, grouped — the *strongest* surface. But the author must know to click, then read a many-field form to find "the data one". |
| 3 | **Bind data** — find the Data facet summary → click *Open workbench* → escalate | DataFacetField → DataWorkbench | `inspector/controls/DataFacetField.tsx:124-141` | The Power-Query three-pane is **two clicks deep behind an escalation**, and `canWorkbench` opens it **only for `query`/`pipeline`/unbound** specs (`:124`). A `row-list` / `timeseries` / `growth` / `ratio-list` element **cannot reach it** → drops to the steward raw editor. Capability cliff. |
| 4 | **Assemble compound parts** — trend, threshold, visibility, per-part style | scattered inspector fields + nested-item escalations | `inspector/controls/NestedItemControl.tsx:264-291` | A KPI strip's trend/threshold/`when`/style are **separate opaque sub-objects**, each its own drill or raw-JSON fall-through. There is no single "here is the object, fill the blanks" moment. |

**Root of the hardness:** the model is **drop-then-hunt**. There is no *intent-first* entry (what do
you want to show?) and no *meaningful whole* to start from — every object is assembled from zero, and
the assembly steps are distributed across surfaces a non-expert does not know exist. AR-49's
metric-first Governed Canvas was designed to fix exactly this; `discovery/MetricPalette.tsx` exists but
the **primary add gesture is still element-first** (NodePalette), not intent/metric-first.

---

## 2. Composition-model benchmark (concept-set, not feature list)

| Platform | The composition primitive that makes assembly non-expert | Do we have it? |
|----------|----------------------------------------------------------|----------------|
| **Builder.io** | **Blocks** = pre-composed, data-bound component instances dropped as a *meaningful whole*; inputs bind inline on the canvas element. | **NO.** We drop blank shells; binding is 2 clicks deep in an escalation. Registry ≈ their component model, but no "block". |
| **Puck** | Component declares `fields` **+ `defaultProps`** → a dropped component is *immediately valid & rendered*, never blank. | **NO `defaultProps` equivalent** (verified). This is the single closest missing primitive. |
| **Form.io** | **Component templates / pre-built layouts** + live preview; add-then-configure but starting from a populated component. | Partial: live canvas (WYSIWYG) yes; **no templates/presets**. |
| **Grafana** | ONE panel editor: viz + query + transform + **field-config (thresholds/mappings)** in tabs, **+ "visualization suggestions" from the data**. | Split: `suggestPanels` "Recommended" **yes** (`NodePalette.tsx:153-163`); but field-config (thresholds/mappings/visibility) is **scattered across inspector fields**, not one panel editor. |
| **Retool** | Component and **query as first-class peer resources**; wire `{{ query.data }}`; query builder is a primary surface, not buried. | We built the peer (DataWorkbench) but it's **reached only via escalation** and gated to query/pipeline. |

**The concept we systematically lack:** a **composed starting point** — a declaration that is already a
valid, data-bound, sensibly-styled *whole*, offered as the unit of insertion. Builder calls it a Block,
Puck calls it defaultProps, Form.io calls it a template, Grafana approximates it with viz-suggestions +
default field-config. It is the difference between "assemble an object" (expert) and "pick an object,
then tweak" (non-expert).

---

## 3. Built-but-buried capabilities (verified in-tree)

Capabilities that are unit-green and in the live app but **off-by-default / unreachable / under-projected**:

| Capability | Built where | Buried how | Evidence |
|-----------|-------------|-----------|----------|
| **DataWorkbench** (Power-Query 3-pane, live per-step grid — *nobody in our class has the live grid*) | `features/data-layer/workbench/DataWorkbench.tsx` | 2 clicks behind an escalation; **gated to query/pipeline/unbound only** — row-list/timeseries/growth/ratio-list cannot reach it | `DataFacetField.tsx:124`, `:130` |
| **VisibilityBuilder** (recursive `when` builder) | `features/visibility` | Wired to filters/perspectives/params/page — **NOT to KPI/featured item `when` nor node `view.visibleWhen`** (~42 occ raw) | usages in `perspectives/`, `filters/ParamDefEditor.tsx:24`; absent from KPI/node view |
| **⚡ bind + responsive + thresholds** (`ValueAuthoringControl`) | `inspector/controls/ValueAuthoringControl.tsx` | Fires only for `BINDABLE_TYPES`/`responsiveCap` fields (`:108,:115`); rich fields stay opaque | `ValueAuthoringControl.tsx:108-144` |
| **suggestPanels "Recommended"** (viz-suggestion from data shape) | `discovery/suggestPanels` | Surfaces only inside NodePalette when a profile is ready; the **metric-first / intent-first path is underused** | `NodePalette.tsx:153-163` |
| **capabilityGate** (capability-gated palette) | `discovery/capabilityGate.ts` | Conservative (gates only data-bound); sound but under-leveraged as a *composition* aid (geo-sniff hardening noted in panel-quality ledger) | `capabilityGate.ts:61-73` |

Distinct from buried: **TrendField is not built** (raw JSON in ~33 places) — a *missing projection*, not
a buried one. It rides whichever option below wins as the first preset payload.

**Why they're buried is one shape:** each is a capability that must be *reached and wired per object by an
expert*, rather than *pre-wired into the object that ships*. That is the same root as the missing preset —
capability injection today is "build the surface, hope the author finds it," never "ship it inside a
composed default."

---

## 4. Options (Strangler-Fig, not rewrite)

### Option A — **Composed-Preset projection** (recommended)
A **preset = a partial element declaration** (a config sub-tree: type + sensible `props` + a bound
`DataSpec` + pre-wired trend/threshold/visibility/style), registered against the SAME open registry and
**projected into the palette** as an insertable whole. Dropping a preset lands a *valid, data-bound,
styled object*. Non-expert assembly becomes *pick-a-whole, then tweak*.
- **Fits the canon:** a preset is pure config (data+intent, no logic — Law 2), stored as SSOT, lossless
  round-trip. It is the homoiconic move: one declaration → palette entry + dropped instance, zero
  per-type projector. Additive registry field → OCP.
- **Activates the buried:** presets ship with DataWorkbench-shaped `pipeline`, `when`, thresholds and
  ⚡binds *already wired* → the buried capabilities become the **default surface of every dropped object**,
  reached by tweaking not hunting. This is the "capability injection pipeline" made real: shipping a
  capability = shipping a preset that uses it.
- **Trade-off (ISO 25010):** +Usability/Learnability, +Reusability; −Maintainability risk = preset
  sprawl / stale presets — mitigated by a curation surface (steward lens) and by presets being *config
  snapshots validated by the same schema*, never bespoke code. Must resist presets drifting into a second
  grammar (they are element declarations, nothing new).

### Option B — **Unbury via default projection** (necessary, insufficient alone)
Wire VisibilityBuilder onto KPI/featured `when` + node `view.visibleWhen`; open DataWorkbench for *all*
data specs (drop the `:124` gate); build TrendField. This is the parity-audit backlog.
- **Trade-off:** activates built capability with lowest risk, but **does not change the assembly model** —
  still drop-then-hunt. Raises the floor, not the ceiling. Best as the *substrate* A rides on.

### Option C — **Intent-first insert** (AR-49 completion, biggest shift)
Make the primary add gesture *pick what to show* (a governed metric/goal) → system proposes element +
binding + preset; NodePalette demotes to "add a block". Front-door = `MetricPalette`.
- **Trade-off:** highest non-expert payoff, but largest surface change; AR-49 M0/M1 already built the
  semantic layer + shell, so it's *completing a routed vision*, not new. Sequence *after* A proves the
  preset payload.

---

## 5. Recommendation

**Ship Option A (Composed-Preset projection) as the first motion, on Option B as its substrate, sequenced
toward C.**

Rationale by duty order: A is (1) config-as-SSOT-clean and lossless (a preset is a validated config
sub-tree), (2) maximally general (declaration→projection, one additive registry field, no per-type
special-case — a new preset is a new *declaration*, machinery unchanged), (3) the most direct lever on the
**authoring-experience canon** (turns "assemble a blank" into "pick a meaningful whole, then tweak"), and
(4) it *is* the capability-discovery/injection mechanism the owner is missing — the buried DataWorkbench,
VisibilityBuilder, ⚡bind and thresholds become the **pre-wired default surface** of every preset, so
"leverage what we already built" is achieved by *shipping it inside the composed default* rather than
hoping the author escalates to find it.

**First slice (Strangler, provable):** add an additive `presets: PartialNodeConfig[]` projection to the
registry meta; project into NodePalette as a "Recommended / Starters" band ahead of raw element tiles;
seed 2–3 statistics-native presets (KPI-strip-with-trend+threshold, GDP-time-series-bound,
regional-table). Fitness function: `FF-PRESET-IS-CONFIG` (every preset validates against the target
schema and round-trips lossless) + `FF-PRESET-NO-SPECIAL-CASE` (palette projects presets with zero
per-type code). Concurrently land Option-B's `:124` gate removal so a dropped preset's workbench is
reachable for *any* spec kind. This is ADR-worthy (extends ADR-038/041; ≥2 rejected alternatives = B-alone,
C-first) — number is the lead's to assign.

**Bounds held:** no object-model change (ADR-041/042 untouched), no engine verb added, no logic in config,
additive/expand-contract only.

---

## Appendix — files read (evidence trail)
`canvas/NodePalette.tsx` · `discovery/capabilityGate.ts` · `features/data-layer/workbench/DataWorkbench.tsx`
· `inspector/Inspector.tsx` · `inspector/controls/DataFacetField.tsx` · `inspector/controls/NestedItemControl.tsx`
(refs) · `packages/react/src/engine/{objectRegistry,slice-meta,NodeRegistry.caps.test}.ts` · `e2e/probes/probe-poffer-open.mjs`
(P-OFFER = the governed-noun option offer in the query step, `features/data-layer/editors/query/steps/offer/`).
