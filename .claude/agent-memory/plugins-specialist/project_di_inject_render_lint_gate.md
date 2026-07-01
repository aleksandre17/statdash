---
name: di-inject-render-lint-gate
description: react-hooks/static-components gate scoping when promoting useInject(ctx.ui, TOKEN)-then-render out of the plugins shell layer into packages/react
metadata:
  type: project
---

The `react-hooks/static-components` rule fires on the `const C = useInject(ctx.ui, TOKEN)` then `<C/>` pattern ("Cannot create components during render"), because it can't statically prove the injected ComponentType is stable.

**Why:** The codebase turns this rule OFF only for `packages/plugins/**` (eslint.config.js, with a documented rationale: `useInject` wraps `container.inject(token)` in `useMemo([container, token])`, both stable per page lifecycle). Panel/chrome SHELLS live in plugins, so they're covered.

**How to apply:** When you promote an inject-then-render seam (e.g. `PanelExportBar`) UP into `packages/react/src/**`, the plugins-scope off-override no longer applies and lint will error. Do NOT widen the override to all of `packages/react` (weakens the gate platform-wide). Add a per-file `files: ['packages/react/src/.../X.tsx'], rules: { 'react-hooks/static-components': 'off' }` block with the same useMemo-stability rationale. This is the established sanctioned pattern in this repo. Alternative (no override) = import + render the concrete component directly, but that drops the DI-override capability the shells deliberately keep.
