---
name: project-node-template-seam
description: useNodeTemplate/resolveNodeTemplate is the ONE canonical shell template-resolution seam; shells never hand-roll the param merge or the `{`-guard
metadata:
  type: project
---

The canonical template-resolution seam for shells lives at
`platform/packages/react/src/engine/hooks/useNodeTemplate.ts`, exported from
`@statdash/react/engine`:
- `resolveNodeTemplate(tpl, sectionCtx, params)` — pure util (undefined/no-`{`
  short-circuit; `{year,range}` union supported). For non-hook call-sites.
- `useNodeTemplate(ctx)` → `resolve(tpl?) => string | undefined` — binds the
  CANONICAL param merge `{ ...ctx.filterParams, ...ctx.vars }` once.

**Why:** before this seam, six shell call-sites hand-rolled the param merge +
`{`-guard in ≥3 inconsistent ways — a DRY violation AND latent correctness bug
(GeographShell merged only filterParams not vars; PageHeader/prependLabel merged
nothing — so `{var}`-style labels silently failed to resolve there).
Standardizing on `{ ...filterParams, ...vars }` everywhere is the correctness fix.

**How to apply:** any shell resolving a template string MUST consume this seam —
never re-derive the merge or guard inline. Real components use `useNodeTemplate`;
shell `render()` object-methods (e.g. PageHeaderShell, not a component) need an
`// eslint-disable-next-line react-hooks/rules-of-hooks` on the `use*` call (the
`use` prefix is ergonomic only — the helper binds no hooks). `resolveTemplate`
(the `@statdash/engine` primitive) stays as-is; the seam WRAPS it.
`core/data/kpi.ts` still calls `resolveTemplate` directly — correct, it's below
react in the arrow and has no filterParams/vars. Related: [[shell-ui-hooks-shared]].
