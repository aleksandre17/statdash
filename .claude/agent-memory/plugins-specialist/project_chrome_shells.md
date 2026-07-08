---
name: chrome-shells
description: chrome/** shells are zero-prop/registry-dispatched with NO RenderContext/placement — node-shell primitives (useNodeTemplate, useCollapsible, variant spine) don't apply here; the checklist + F1-lock/count-guard for adding a new inline chrome slot
metadata:
  type: project
---

**Scope note (from a full DEPTH sweep of `packages/plugins/chrome/**`):** the shared
node-shell primitives mostly DON'T apply to chrome shells — chrome shells are
zero-prop, registry-dispatched, and have NO `RenderContext`/`placement`/`vs`. So
`useNodeTemplate`/`resolveNodeTemplate` (RenderContext-bound), `mergePlacement`,
`useCollapsible`/`useDisclosure` (boolean-disclosure) have no call site here. Chrome
localizes via `useResolveLocale()` (`t(LocaleString)`), NOT the node-template `{...}`
seam — don't force-fit them. `accentStyle(color)` DOES apply (it's a plain CSS-var
helper, not RenderContext-bound). Runtime-state modifier classes (accordion
open-section, `is-active`/`locale-switcher__btn--active`) are RUNTIME state, not
authored `def.variants` — the FF-NO-VARIANT-CLASS gate is section-scoped only, so
leaving them as plain state classes is correct (see
[[feedback_variant_spine_vs_runtime_state]]), not a smell to churn.

**How to apply:** chrome/** is a low-yield target for primitive-adoption churn — the
real adoption surface is the NODE shells (section/page-header/geograph/panels), which
DO carry RenderContext.

---

**Adding a new inline chrome slot** (mirroring the locale-switcher/theme-switcher
shape):

- **Inline nested slots are NOT in provisioning.** LocaleSwitcher + ThemeSwitcher are
  embedded directly in `AppHeaderShell.tsx` via `<ChromeSlot slot="..."/>` and resolve
  to variant `'default'` with zero provisioning entry (`ChromeSlot: pickVariant ??
  'default'`). Only REGION slots (AppHeader/AppFooter/InnerSidebar/AppBanner) appear
  in `geostat.provisioning.json` `chrome`. So "place beside the locale switcher" = an
  `AppHeaderShell` JSX edit, not a provisioning edit (an override is still possible via
  `site.chrome.<Slot>`).
- **Checklist:** (1) folder under `chrome/<slot>/default/` — Shell + `index.ts` META
  (`sliceType:'chrome'`, `defaultRegion:'inline'`); (2) one line in `chrome/index.ts`
  barrel (→ `Object.values(Chrome)` → `registerSlice` in `setupRegistrations.ts`);
  (3) `<ChromeSlot slot="..."/>` in the parent shell. No provisioning entry needed.
- **`ChromeConfig` base is F1-locked.** `chrome-config.fitness.test.ts` F1 asserts
  `ChromeConfig` = EXACTLY `[logoUrl, logoAlt, localeLabels, copyright]`
  (set-equality). A new chrome slot CANNOT add a label field (e.g. `themeLabels`) to
  that base — use `useSlotConfig()` per-instance config (+ a meta `PropSchema`) or a
  built-in agnostic default (theme-switcher uses a built-in `THEMES` const,
  light/dark, OCP-open to `system` — so it's schema-less).
- **Schema-less slots have a HARD count guard.** `schema-completeness.fitness.test.ts`
  — a schema-less variant must be added to `CHROME_EXEMPT` AND its
  `expect(CHROME_EXEMPT.size).toBe(N)` bumped (adding the set entry alone fails the
  count assertion, line ~230). Variants WITH per-instance config go in
  `CHROME_WITH_CONFIG` instead (asserted to carry a non-empty schema).
- **Theme persist mechanism** (AR-13): `useTheme` hook co-located in the node folder
  (not `packages/react`) — localStorage key `statdash-theme` + `prefers-color-scheme`
  as the unset default, projects `[data-theme=light|dark]` on `document.documentElement`.
  Rides the token cascade (tokens.css: unset⇒`@media` system,
  `[data-theme=dark|light]`⇒explicit). OCP: a `'system'` id maps to REMOVE-attribute ⇒
  `@media` wins.
