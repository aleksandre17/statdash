---
name: binding-autocomplete
description: Schema-aware Retool-class autocomplete for the bound-mode expr editor — governed-noun vocabulary, WCAG combobox, live preview
metadata:
  type: project
---

# Schema-aware binding editor (mission #4, LANDED)

The bound-mode expr is now a discoverable, guided editor (was a blind raw string). Built on the unified `ValueAuthoringControl` BindEditor — did NOT fork a new control.

**Why:** binding + thresholds + responsive had landed; the bound mode was the last non-programmer-usable gap (a raw expr typed blind). This is the Retool `{{ }}` / Grafana-class discovery surface.

**How to apply / anatomy** (all in `platform/apps/panel/src/inspector/controls/binding/`):
- `bindSuggestions.ts` — PURE brain: `governedSuggestions` (metrics+dims → bilingual label, metric inserts governed id NEVER raw code, dim inserts its `code`), `scopeRefSuggestions` (params+vars), `operatorSuggestions` (formula infix ops labelled FROM `OPS_CATALOG` — no second catalog; the formula surface is INFIX so ops insert SYMBOLS like `==`/`&&`, not JSON op names), `rankSuggestions`, `tokenAtCaret`/`applySuggestion`, `unknownRefs`. Fitness: `bindSuggestions.fitness.test.ts` = **FF-BIND-AUTOCOMPLETE-GOVERNED** (15 assertions).
- `useBindVocabulary.ts` — wires live `useMetricCatalog()` (describeApp catalog) + active page `meta.filterSchema` params + `meta.vars` into the vocabulary; dedupes by insert token (param/var wins over colliding dim code = guaranteed scope.dims key).
- `ExprAutocompleteInput.tsx` — WCAG combobox/listbox (aria-activedescendant, ↓↑/Enter/Tab/Esc); the input IS role=combobox (class `insp-expr-ac__input insp-bind__expr`).
- `ValueAuthoringControl.tsx` BindEditor now takes `locale`, renders the combobox + a non-blocking unknown-ref hint.

**Key architectural truth:** the NODE binding scope (renderNode buildBindScope) = `dims`(filterParams) + `derived`(vars) + `rows`. A bare identifier lowers via `nodeFieldPolicy` → `coalesce($ctx:id, $derived:id)`. Metrics aren't directly in that scope — surfacing them is governed-vocab discovery; the honest live-preview covers the resolve-live/no-data case (never a fake value). This is the documented generalization edge.

**Untouched (constraints held):** binding seam `renderNode.ts` 2.7, `binding.ts` model, ADR-038/041 object model, threshold/responsive models. Panel-only (Law 3).

**Gate at land:** full `tsc -b` 0 · full eslint 0 err · full vitest 3587 pass / 3 fail ALL pre-existing (`perspective-render-validation.test.tsx`, `token-cohesion` flagging `packages/react/.../Select.css` — both in packages that can't import apps/panel; token-cohesion empirically reproduced with my edits reverted) · live :5173 e2e `bindAutocomplete.e2e.ts` green + propBinding + responsiveAuthoring green (no regression). Commits 5e0f5f7 (impl+fitness), 6e809fe (e2e).
