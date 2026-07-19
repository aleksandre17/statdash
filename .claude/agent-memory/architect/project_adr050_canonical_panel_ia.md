---
name: adr050-canonical-panel-ia
description: ADR-050 — the canonical panel IA spine; the "engine-canonical, projection-missing" disease + the R1→R6 remedy; owner-blessed 2026-07-19
metadata:
  type: project
---

ADR-050 (`docs/architecture/decisions/ADR-050-canonical-panel-ia.md`), owner-blessed 2026-07-19, card 0102. Formal decision record for `STUDY-canonical-panel-ia.md`.

**Disease:** "engine-canonical, projection-missing" — the full site-builder spine EXISTS in the object model but is un-projected in the studio. The panel reads as chaos not from bad architecture but from un-projected canonical capability.

**The spine:** DATA → SITE (SiteDef) → SKELETON (= registered page-kind × page-level PresetDecl; CHROME = ordered sourced Parts of the site-frame, *arranged not configured*) → PAGE → SECTION/ELEMENT (composed presets) → BINDING (DataSpec) → PUBLISH.

**The ONE structural move:** skeleton = registered page-kind × PresetDecl — a confirmation/generalization of ADR-049 P2b's `NodeSeed.type` (page roots are registered types). Explicitly FORECLOSES a separate template-document species (rejected as a 5th grammar, Law 10/ADR-041). Extends 038/041/042/049 — never forks; no engine object-model change.

**Governing invariant (this ADR's canon contribution):** every canonical engine capability MUST be projected. A registered-but-unreachable capability is a defect of the same class as the disease.

**Remedy R1→R6 (WIP=1, Strangler):** R1=0101 (floor: empty-container droppable + page-frame containment + page-tab→URL) · R2=ADR-049 P2b presetRegistry · R3=skeleton restoration (kind gallery + retype + fixtures→declarations; guards FF-SKELETON-CHOOSABLE + FF-STARTERS-ARE-DECLARATIONS) · R4=chrome-as-arranged-Parts (project resolveChrome order, kill the raw NumberControl `chromeFacetModel.ts:56`) · R5=one Site home + rail reads the spine (folds SPEC-studio-ia-canonical S5) · R6=data-floor polish.

**Cited seams:** page-kinds `plugins/pages/meta.ts`; hidden default `PageBrowser.tsx:89` + `canvasPageAdapter.ts:45`; starters fixture `starterTemplates.ts`; chrome order chain `resolveChrome.ts` projecting as `chromeFacetModel.ts:56` NumberControl.

Related: [[project_part_grammar_foundation]] [[project_s6_chrome_unification]] [[feedback_architect_deliver_and_stop]] [[feedback_protection_layer_first_class]].
