---
name: icon-token-rendering
description: Panel ESLint forbids `const Icon = fn(); <Icon/>` (react-hooks/static-components) — render token→component via createElement in a .ts helper
metadata:
  type: feedback
---

When rendering a registry icon TOKEN (e.g. `NodeSliceMeta.icon` = 'bar-chart') to a
component, do NOT alias the resolver result to a capitalized var and use it as JSX:

```tsx
const Icon = resolvePaletteIcon(token)   // ❌ react-hooks/static-components ERROR
return <Icon fontSize="small" />         //    "component created during render"
```

Instead, expose a JSX-free render helper in a plain `.ts` module and call it:

```ts
// paletteIcons.ts  (no JSX → not a component-export file, no react-refresh warning)
export function renderPaletteIcon(token, props) {
  return createElement(resolvePaletteIcon(token), props)
}
```
```tsx
{renderPaletteIcon(entry.icon, { fontSize: 'small' })}   // ✅
```

**Why:** the panel's ESLint config enables `react-hooks/static-components` (an
error, not a warning) and `react-refresh/only-export-components` (a warning if a
`.tsx` exports non-components). `createElement` in a `.ts` avoids both. The
established repo pattern is a token→component registry map + a single resolve seam
with a neutral fallback (see `plugins/.../navIcons.tsx`).

**How to apply:** any time a component is chosen at runtime from a data token
(icons, dynamic shells) in `apps/panel`. Keep the map + resolver in a `.ts` file.
Note: MUI icons are memo/forwardRef objects (`typeof` is `'object'`, not
`'function'`) — assert with `toBeTruthy()`, not `toBe('function')`, in tests.
