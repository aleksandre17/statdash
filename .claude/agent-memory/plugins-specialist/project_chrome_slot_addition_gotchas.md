---
name: chrome-slot-addition-gotchas
description: Adding a chrome slot node (theme-switcher/locale-switcher shape) — inline embedding, ChromeConfig F1 lock, and the exempt-set count guard
metadata:
  type: project
---

Adding a new chrome slot node that mirrors the locale/theme switcher shape.

**Inline nested slots are NOT in provisioning chrome.** LocaleSwitcher + ThemeSwitcher are embedded in `AppHeaderShell.tsx` via `<ChromeSlot slot="..."/>` and resolve to variant `'default'` with zero provisioning entry (ChromeSlot: `pickVariant ?? 'default'`). Only REGION slots (AppHeader/AppFooter/InnerSidebar/AppBanner) appear in `geostat.provisioning.json` `chrome`. So "place beside the locale switcher" = an AppHeaderShell JSX edit, not a provisioning edit. An override is still possible via `site.chrome.<Slot>`.

**Why:** a charge may assume locale is provisioning-declared; it isn't — inline-default is its defining trait.
**How to apply:** for a new inline chrome slot, mirror by (1) folder under `chrome/<slot>/default/` {Shell + `index.ts` META `sliceType:'chrome'`, `defaultRegion:'inline'`}, (2) one line in `chrome/index.ts` barrel (→ `Object.values(Chrome)` → `registerSlice` in `setupRegistrations.ts`), (3) `<ChromeSlot slot="..."/>` in the parent shell. No provisioning entry needed.

**ChromeConfig base is F1-locked.** `chrome-config.fitness.test.ts` F1 asserts `ChromeConfig` = EXACTLY `[logoUrl, logoAlt, localeLabels, copyright]` (set-equality). A new chrome slot CANNOT add a label field (e.g. `themeLabels`) to that base — use `useSlotConfig()` per-instance config (+ a meta PropSchema) or a built-in agnostic default. Theme-switcher chose a built-in `THEMES` const (light/dark, OCP-open to `system`), so it is schema-less.

**Schema-less chrome slots have a HARD count guard.** `schema-completeness.fitness.test.ts` — a schema-less variant must be added to `CHROME_EXEMPT` AND its `expect(CHROME_EXEMPT.size).toBe(N)` bumped. Adding the set entry alone fails the count assertion (line ~230). Variants WITH per-instance config go in `CHROME_WITH_CONFIG` (asserted to carry a non-empty schema) instead.

**Theme persist mechanism (AR-13, BUILT 2026-07-01):** `useTheme` hook co-located in the node folder (not packages/react) — localStorage key `statdash-theme` + `prefers-color-scheme` as the unset default, projects `[data-theme=light|dark]` on `document.documentElement`. Rides the e74414d token cascade (tokens.css: unset⇒@media system, `[data-theme=dark|light]`⇒explicit). OCP: a `'system'` id maps to REMOVE-attribute ⇒ @media wins. See [[merged_vs_defview_label]] for accentStyle/token discipline.
