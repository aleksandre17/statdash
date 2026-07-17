---
name: dynamic-property-binding
description: The ⚡/`{{ }}` dynamic-binding capability — value model, the ONE render seam, honest states, and the OCP generalization path
metadata:
  type: project
---

Dynamic property binding (Builder.io ⚡ / Retool `{{ }}`) landed as a live vertical slice (branch feat/ar49-m0-metric-first-authoring). Any authorable scalar prop may be a LITERAL or `{ $bind: "<expr>" }`.

**Why:** the code-confirmed gap vs the reference class — `PropField` was rich but EVERY scalar value was a static literal; no per-prop literal-OR-expression model. This is the additive value-model that generalizes to every prop (OCP).

**How to apply / where it lives (the durable seam):**
- VALUE MODEL + RESOLVER: `platform/packages/core/src/config/binding.ts` — `Binding {$bind}`, `isBinding`, `resolveBinding` (tri-state `ok`/`no-data`/`error`, never throws; a REAL 0/false is `ok`, only null/undefined is `no-data`), `resolveBindings` (deep walk, reference-stable when no binding, SKIPS `children`/`items` + any object with a string `type` = child nodes). Node-level identifier policy = `coalesce($ctx id, $derived id)` (bare name → filter-param else var). Reuses `@statdash/expr` `parseFormula`+`evalExpr` — NO second evaluator (Law 2). Exported through core barrel + `@statdash/react/engine`.
- THE ONE RENDER SEAM: `platform/packages/react/src/engine/renderNode.ts`, in `renderWithRows` step 2.7 (after node-vars, before view/shell). Builds an ExprScope from ctx (dims=filterParams, derived=vars, rows) via `buildBindScope`, resolves `migrated`→`rnode`, and the shell/children/view read `rnode`. Honest state: `renderBindingState` (mirrors `renderValidationErrors`) returns a `[data-binding-state]` banner INSTEAD of the shell when a binding failed (Law 11 "canvas never lies").
- INSPECTOR AFFORDANCE: `platform/apps/panel/src/inspector/controls/BindableControl.tsx` (+ `.css`) wraps every field's control in `Inspector.tsx renderField`; ⚡ toggle + expr editor + live preview (evaluates against empty scope — catches bad exprs, shows constants, annotates live refs). Gated to scalar types (string/number/color/LocaleString) via `BINDABLE_TYPES`.
- HONEST CSS: `.node-binding-state` in `packages/react/src/components/feedback/feedback.css` (token-only — the FF-TOKEN-ONLY gate scans react/src CSS; NO hex fallbacks allowed there).

**Generalization path (not yet built):** per-row/collection bindings (inject a `{$row}` field policy); widen `BINDABLE_TYPES`; honest-state nodes should stamp the Part anchor so an errored node stays SELECTABLE (currently the banner replaces the shell → no overlay frame, like the validation-error path); richer in-Inspector live-scope preview (currently empty-scope best-effort). Proven live via `apps/panel/e2e/propBinding.e2e.ts` (real Chromium bundle, :5173) — see [[project_benchmark_corpus]] for the reference-class SSOT.

**Pre-existing failures on this branch (NOT from this work, proven via targeted stash):** `perspective-render-validation.test.tsx` (2, `ReferenceError: Worker is not defined`) + `token-cohesion.fitness` (1, `Select.css` rgb/hsl, committed b24aa02). See [[worktree_base_hazard]].
