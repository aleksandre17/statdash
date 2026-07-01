---
name: variant-spine-vs-runtime-state
description: When to use the declared-variant spine (resolveVariants/variantAttrs) vs plain data-* state attributes vs aria-selected, for killing BEM-modifier class logic in shells
metadata:
  type: feedback
---

The shell-variant-style spine (`meta.variants` → `resolveVariants` → `{...variantAttrs}` → `[data-*]` CSS, section/default exemplar) is **only** for AUTHORED, Constructor-configurable modifiers read off `def.variants` (e.g. section `emphasis`). It is NOT the tool for ephemeral runtime interaction state.

**Why:** the spine resolves `def.variants` (the authored bag) against declared `VariantSchema`. Runtime state (which tab/slide/card is selected via `useState`, fade visibility) has no `meta.variants` declaration and isn't Constructor-authorable — forcing it through the spine is wrong.

**How to apply** when killing `['x', cond && 'x--mod'].join`/`${cond ? ' is-active' : ''}` modifier-class logic in a node/page shell:
- Authored enum/flag off `def.*` (e.g. divider style, filter-bar position) → emit a `data-*` attr from the value; CSS selects `[data-attr="val"]`. (Spine proper if it's a real `def.variants` field.)
- Runtime selection state where the element already has `aria-selected` (mode-bar tabs, tab-page tabs) → drive CSS off `[aria-selected="true"]`. Zero extra attribute, accessibility-correct, byte-identical.
- Runtime state with no aria channel (stats-carousel tabs/indicators, hero cards) → `data-current`; fade/visibility → `data-visible`; trend → `data-trend="up"|"down"`.
- AVOID `data-active` for selection: the @statdash/styles spine already owns `[data-active]` for the `:active` pseudo-state (`node-styles.css`). Collision. Use `data-current` instead.

Byte-identical rule: emit the attr as `cond ? '' : undefined` (presence flag) so absent state renders no attribute, matching the old absent-class behavior. CSS `.block[data-x]` (presence) mirrors `.block--mod`.

The FF-NO-VARIANT-CLASS fitness gate is currently SCOPED TO section only (`nodes/section/default/variant.fitness.test.ts`) — do not flip it global. Other shells aren't yet gated, so leaving a static skeleton `--modifier` (e.g. `mode-tab-group--skeleton` on an aria-hidden skeleton) is acceptable per YAGNI.
