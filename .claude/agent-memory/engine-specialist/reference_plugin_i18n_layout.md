---
name: plugin-i18n-layout
description: How plugins are laid out (no src/) and where their i18n / palette content lives — the two-tier tenant-content boundary
metadata:
  type: reference
---

`platform/packages/plugins` is NOT under a `src/` dir — it is organised by feature
folders: `nodes/`, `panels/`, `chrome/`, `controls/`, `pages/`, plus root
`registry.ts` / `catalog.ts`. (Contrast: `core`, `react`, `styles`, `charts`,
`contracts` use `src/`; `expr` keeps source at its root.) Any tooling that scopes
to `**/src/**` will silently SKIP the entire plugins package — that is how the
GeoMap `"მლნ ₾"` leak went un-audited.

Per-slice metadata lives in:
- `meta.ts` — Constructor palette `label: { ka, en }` + a bilingual `i18n: { ka, en }`
  UI-string bundle (backed by i18next; resolved at runtime via `useT(ns)`).
- `*Node.ts` — `PropSchema` field labels + `PropertyGroup` labels (editor chrome).
- Chrome slices put their `META: ChromeSliceMeta` (with palette `label`) in `index.ts`.

Tenant-content boundary (enforced by `platform/tests/no-tenant-content.fitness.test.ts`):
- **Legitimate (residual, allowlisted):** bilingual `{ ka, en }` catalog content in
  the meta/Node/SliceMeta descriptors + styles/core/expr catalogs + OBS_STATUS_LABELS.
  This is the engine i18n machinery working as designed. De-coupling it into a
  tenant-supplied i18n registry is an ARCHITECT-owned redesign (engine public API).
- **TRUE LEAK (must fix):** Georgian/currency/brand literals in rendering/logic
  (`*Shell.tsx`, `components/*.tsx`, `_*.ts`) — these bypass the i18n channel.
  Fix pattern: route through `useT(ns)` (+ add an `i18n` bundle to the slice meta),
  or take the text as config/props (e.g. ChromeConfig `brandTitle`/`copyright`,
  ParamCascade `allLabel`, ParamRange `fromLabel`/`toLabel`, GeoMap `unit`).

Chrome shells read brand from `useChromeConfig()` (react `context/ChromeConfig.ts`)
+ `useResolveLocale()` — see `AppFooterShell` for the canonical pattern.
