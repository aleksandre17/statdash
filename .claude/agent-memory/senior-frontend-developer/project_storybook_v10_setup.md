---
name: storybook-v10-setup
description: Storybook in @statdash/react resolves to v10 — addon-essentials & @storybook/test are deprecated v8-only packages; use core + addon-docs instead
metadata:
  type: project
---

Storybook lives in `platform/packages/react` (config at `packages/react/.storybook/`, script run via `pnpm --filter @statdash/react storybook` so cwd finds the config). Core deps are hoisted to the workspace root `platform/package.json`.

**The version-alignment trap:** installing `storybook` + `@storybook/react-vite` resolves to **v10** (10.4.5 as of 2026-06). The old standalone addons named in older docs/specs are deprecated and DO NOT exist for v10:
- `@storybook/addon-essentials` — frozen at 8.6.14; its addons (controls, actions, viewport, backgrounds, toolbars, measure, outline, highlight) are built into v10 core. Do NOT list it in `main.ts`.
- `@storybook/test` — renamed; v10 exposes it as the `storybook/test` subpath export.
Installing them anyway pulls v8.6.x against v10 core → unmet-peer breakage.

**Why:** Storybook 8.3+ merged essentials into core and the package layout changed again by v10.

**How to apply:**
- For autodocs/MDX use `@storybook/addon-docs` (ships v10) — it's the one separately-installed addon.
- Import `Meta`/`StoryObj`/`Preview` from `@storybook/react-vite` (the framework package), NOT `@storybook/react` (not directly installed — only a transitive dep).
- v10 `backgrounds` API: `parameters.backgrounds.options` (keyed map) + `initialGlobals.backgrounds.value`; the legacy `{ default, values }` shape is deprecated. The deprecated `docs.autodocs` config key is gone — the `autodocs` story tag drives it.
- Pre-existing unrelated peer warning: `react-apexcharts@1.9.0` wants `apexcharts>=4` but `apps/geostat` has 3.54.1 — not caused by Storybook work.

See also [[config_api_contract]].
