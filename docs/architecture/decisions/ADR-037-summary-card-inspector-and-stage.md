# ADR-037 — The Summary-Card Inspector and the Stage (the Placement Law completed)

**Status:** PROPOSED (draft for owner sign-off) · **Date:** 2026-07-11 · **Author:** platform-architect
**Spec:** `docs/architecture/proposals/SPEC-worldclass-authoring-ui.md` · **Extends:** `SPEC-studio-shell-layout.md` (Placement Law), ADR-022 (D7 `itemSchema`), M4 Wave 7 (tri-context dock)

## Context

The right dock still "doesn't fit" after SL-0..SL-5. Root-cause analysis (spec §0–§1) found the Placement Law is correct but *incomplete*:

1. It is a **negative law** — it evicts workspace-weight editors from the dock but never defines what the dock positively shows in their place. Evicted subjects became invisible (a doorknob button), and rich values that stayed fell to raw-JSON textareas (`FieldControlRegistry` registers `JsonControl` for `DataSpec`/`ChartDef`/`object`/`array`). The dock is simultaneously sparse and miscast.
2. The escalation terminal (`FocusView`) renders the **editor without the subject** — a form in a void, breaking the WYSIWYG loop every reference platform preserves at workspace depth (Grafana panel editor, Superset/Looker Explore, Figma/Framer enter-component).
3. Weight is derived from schemas that are knowingly incomplete (`SCHEMA_TODO`), so the law mis-weighs workspace-intent subjects as form-weight.

## Decision

Adopt **two corollaries** that complete the Placement Law (they extend it; they do not replace it):

1. **The Summary Corollary.** The dock always renders `summarize(subject)` — a constant-size, populated glance projection — for EVERY subject in the current scope; `place(scope, weight)` locates only the subject's *editor*. Rich/opaque field types render a `SummaryCard` (per-rich-type `summarize()` registry, generic fallback), never raw JSON on the default path. Consequence: the dock's content weight is bounded by construction (scalars + constant cards) AND nothing is ever buried — eviction ≠ invisibility.

2. **The Stage Contract.** The `focus-view` container's realization MUST carry a **live subject slot** beside its editor slot: `stage = { subject, editor, breadcrumb }`, the subject rendered by the same components the canvas uses. The focus-view registry becomes a stage registry (`renderSubject` + `renderEditor`, additive). The routed separate-screen decision (owner, 2026-07-10) is unchanged — only the screen's content contract grows. Named stages: Chart Studio, Filters, Perspectives, Metric Calc, Model (whose subject is the Data-Flow map, a pure projection of existing registries).

## Alternatives considered (rejected)

1. **Widen/split the dock (Sanity-style stacked panes in the column).** A column is a column; nested panes reproduce the cram at higher density. Sanity's pattern needs full-window width — which is the Stage.
2. **Persistent bottom dock for heavy editors (Retool).** Two permanent chrome regions, vertical space taken from the canvas, an idiom for query developers not statistical authors. Its layout survives only *inside* the Filters stage.
3. **Tune the form-only focus-view (styling/sections).** Symptom patch — the missing element is the subject, not typography; owner dissatisfaction after SL-0..5 is the empirical falsification.
4. **In-canvas overlay workspace instead of the routed screen.** Contradicts the owner's binding clarification; the Stage achieves the WYSIWYG property on the routed screen.
5. **Stored lineage/graph model for the flow map.** A second truth; the map must remain a projection (`FF-FLOWMAP-IS-PROJECTION`).

## Consequences

- The dock becomes **constant-weight and never sparse**: overflow is unrepresentable (strengthens FF-NO-CRAMMED-DOCK → **FF-DOCK-CONSTANT-WEIGHT**), and every capability in scope is visible as a card (**FF-SUMMARY-EVERYWHERE**).
- Raw JSON leaves the authoring surface (**FF-NO-RAW-JSON-DEFAULT**; dev-flag escape only).
- Workspace editing regains the artifact (**FF-STAGE-HAS-SUBJECT** — a registered stage without a live subject fails the fitness suite).
- `SCHEMA_TODO` can drain safely (heavy fields land as cards, not crams) — the law's weights become honest; nested drain still rides the already-gated ADR-022 seam (no new one-way door).
- RightDock's ad-hoc composition (hardcoded VisibilitySection/context editors/page panes) is absorbed into a **section registry** — one grammar, OCP.
- Trade-off (ISO 25010): + usability, + learnability, + maintainability (three projections replace hand-built panels); − a one-time migration cost for the two existing focus-view targets and the dock composition; transient risk of summary/value drift, mitigated by deriving `summarize()` from the same schema+value the editor uses (never a second data path).

## Fitness functions

FF-DOCK-CONSTANT-WEIGHT · FF-SUMMARY-EVERYWHERE · FF-NO-RAW-JSON-DEFAULT · FF-STAGE-HAS-SUBJECT · FF-GROUP-FIELDS-EXIST · FF-LINEAGE-AT-POINT-OF-USE · FF-FLOWMAP-IS-PROJECTION · placement-audit v2 (existing FF-PLACEMENT-* extended over the corollaries).
