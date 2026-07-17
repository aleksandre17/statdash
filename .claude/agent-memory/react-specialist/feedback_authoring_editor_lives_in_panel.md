---
name: authoring-editor-lives-in-panel
description: The schema-driven authoring UI (Inspector, FieldControlRegistry, FieldControls) lives in apps/panel, NOT packages/react — the arrow forbids react→panel
metadata:
  type: feedback
---

The Constructor's schema-driven authoring UI — `Inspector`, `FieldControlRegistry`,
`fieldControl.types`, `SchemaSource`, and all `FieldControl`s (TextControl, LocaleField,
EnumRefField, JsonControl, and the D7.1 `ArrayOfControl`/`ObjectControl`) — lives in
`apps/panel/src/inspector/`, NOT in `packages/react`. `packages/react` has only
`PropSchemaForm.tsx`, a headless zero-dep reference form that is explicitly DEMOTED /
marked-for-retirement (it can't do enum-ref/locale resolution without violating Law 3).

**Why:** the dependency arrow is `…core ← react ← plugins ← apps/*`. The panel's
FieldControl stack depends on app-level types (`types/constructor` `Locale`/`CanvasNode`)
and app resolvers (cube-profile enum-ref), so it CANNOT live in `packages/react` —
`packages/react` may never import from `apps/panel`. ADR-022 confirms: the D7.1 nested
editor is `apps/panel`, needing no engine change. A brief that says "the editor in
`packages/react`" is using "packages/react" loosely for "the generic/app-agnostic
authoring layer" — the correct HOME is `apps/panel/src/inspector/`, and "app-agnostic"
is honored there by staying GENERIC over any PropSchema (no Geostat/domain literals).

**How to apply:** any new authoring control / editor / Inspector work goes in
`apps/panel/src/inspector/`, registered via `FieldControlRegistry` (precedence in
`resolve()` for type+modifier routing like array-with-itemSchema; `register(key,…)` for
a plain new PropFieldType). Keep it generic (no hardcoded field names). The engine-side
seam (PropField shape, `getAtPath`/`setAtPath`, wire bridge) is `packages/core` +
`packages/react/src/engine`. Related: [[packages-react-agnostic]].
