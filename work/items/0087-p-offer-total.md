---
id: "0087"
title: "P-OFFER TOTAL — offers across the WHOLE pipeline via field-ROLE declaration (owner directive: nothing missed, nothing unbuildable, agnostic forever)"
status: QUEUED (2026-07-18, owner verbatim: «მთელ პაიპლაინზე ვრცელდებოდეს შემოთავაზებები… არაფერი გამორჩეს… ვერაფერი ვერ ააწყო — არასდროს… აგნოსტიკური, ხვალ ახალი დაემატოს — არ გატყდეს, ჩაერთოს»; fires after 0086+0085 → 0084)
class: M
priority: P0
owner: lead → engine-specialist + senior-frontend (Opus; core seam + generic projection)
implements: declaration→projection (the Bounded-Element ideal) · P-OFFER principle (card 0082 log) · closes the twice-flagged hand-map debt (W-P2 finding: VERB_LABELS/FIELD_VALUE_KEYS; W-P4 pre-note #5: schema field-role metadata)
links:
  - platform/packages/core/src/data/transform/step-registry.ts        # category seam precedent — role joins it
  - platform/apps/panel/src/features/data-layer/editors/query/steps/  # FilterStepForm = the realized pattern (FieldPicker/MemberPicker/offer)
  - platform/apps/panel/src/features/data-layer/pipeline-preview/stepInput.ts  # StepInputOffer — the data-derived offer SSOT
---
**The mechanism:** every op's authoring `PropSchema` fields gain a declared **role** — `'field'` (an input column) · `'member'` (a column's value) · `'newName'` (a genuinely new identifier — free text stays legitimate) · `'expr'` (the one expr editor w/ governed autocomplete) · `'literal'`. Additive core seam beside `category` (same registration site, same projection discipline). The ONE generic `TransformStepEditor` projects role→control: field→FieldPicker (input columns, governed labels) · member→MemberPicker (actual distinct values, Excel AutoFilter) · expr→the existing autocomplete editor. The hand-maps (`FIELD_VALUE_KEYS`/`FIELD_RECORD_KEYS`, W-P2's local labels) DIE — the schema is the SSOT.

**The three owner guarantees, each a gate:**
1. **Nothing missed** — `FF-ROLE-COVERAGE` (the CATEGORY_PIN pattern): every schema field of every registered op carries a role decision; an unroled field fails loudly with a pointer. A NEW op cannot ship without its offer story.
2. **Nothing unbuildable** — the honest fallback everywhere (unrepresentable value → free text, never lost — the FilterStepForm contract generalized) + `FF-OFFER-ROUNDTRIP`: for every op, every payload shape the ENGINE accepts is authorable through the projected form (fixture per op; steward plane keeps raw JSON as the last-resort door).
3. **Agnostic forever** — offers derive ONLY from the step-input rows (`StepInputOffer` — columns/members computed from data, no configured list): a new dimension or member in tomorrow's raw data joins the offers with ZERO code change (Law 1). Fitness: feed a fixture with an unseen dim → it appears in FieldPicker/MemberPicker.

**EXPR/TEMPLATE FIRST-CLASS (owner directive 2026-07-18 — «ის მიმართულებაც გავითვალისწინოთ და საერთაშორისო დონეზე გადავწეროთ»; the full strength of `role='expr'`/`role='template'`):**
- **Anchors (Law 4):** Power Query Custom Column (available-columns list, click-to-insert, syntax check, result preview) · Retool `{{ }}` (autocomplete + live evaluated value) · Airtable formula (function palette, friendly errors) · Excel formula bar (the most familiar gesture on earth).
- **The build:** every expr-carrying field (`derive`/`addField`/`template`/`concat`/window…) projects to the EXISTING schema-aware expr editor (`ExprAutocompleteInput` — REUSE, capability #4) with its scope EXTENDED by the STEP-INPUT COLUMNS (offered by governed label, inserted as the exact ref shape the evaluator accepts — derive the offer from the ONE evaluator/extractDeps SSOT, never a parallel list); a **live evaluation preview** against the sample input rows (the Power Query dialog moment — the author sees the computed value per row BEFORE committing; rides the same one-derivation grid rows, capped+honest per E3); `template` placeholders OFFERED from columns (click-to-insert, never typed); bilingual friendly errors (never a raw parse trace in the author plane).
- **Gate:** FF-EXPR-SCOPE-SSOT — the editor's offered scope == what the evaluator actually resolves for that step (equality vs the engine, not a hand-list); the preview uses the one evaluator (`@statdash/expr`), never a second interpretation.

**Boundaries.** No new engine verbs/grammar (roles are authoring metadata) · refusal #4 holds (no bespoke per-op form — the projection is generic) · ONE evaluator — the preview and the autocomplete scope both derive from `@statdash/expr`/extractDeps, never a panel-side re-implementation · dark-safe tokens (8d86baf class) · bilingual, WCAG · one derivation path for offers (the grid's rows).

**DoD.** Every one of the 19 ops authors through role-projected offers live (:3013 walk over at least filter/aggregate/derive/sort/lookup with real data — pick, never type) · FF-ROLE-COVERAGE + FF-OFFER-ROUNDTRIP + the agnostic fixture green · hand-maps deleted · gates: full vitest + tsc + lint (packages touched → dist + full ritual) · screenshots · zero console errors.
