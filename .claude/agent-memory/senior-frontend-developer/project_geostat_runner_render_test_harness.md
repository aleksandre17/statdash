---
name: geostat-runner-render-test-harness
description: How to write a full render-path test for the geostat runner (vitest config quirks, jsdom shims, registration boot) in platform/apps/geostat
metadata:
  type: project
---

Writing a component render-path test for the geostat runner (apps/geostat) — the setup is non-obvious.

**Why:** The geostat runner is a de-tenanted SDUI runner (ADR-0028); proving tenant-agnosticism / any full-page render needs SiteProvider → MemoryRouter → LocaleGuard → AppChrome → NodePageRenderer. Several env gaps block this out of the box.

**How to apply:**
- Boot like main.tsx: `i18next.init({lng:'en',fallbackLng:'en',resources:{},interpolation:{escapeValue:false}})` then `setupRegistrations()` in `beforeAll`. setupRegistrations registers every node/panel/page/chrome/control slice into `nodeRegistry` — without it `nodeRegistry.get(type)` is empty and nothing renders.
- Register manifest data at render time as App.tsx does: `manifest.modes.forEach(modeRegistry.register)` + `registerFormatters(manifest.i18n.locales)`.
- `@testing-library/react` + jest-dom live in the ROOT platform/package.json devDeps (hoisted), NOT in apps/geostat/package.json. They resolve fine from the geostat project.
- The geostat vitest project name is `national-accounts` (the package name), not `geostat` — `vitest --project national-accounts`, or just pass the test file path.
- jest-dom matchers + jsdom observer shims must be loaded via `setupFiles` — added `apps/geostat/vitest.setup.ts` (imports `@testing-library/jest-dom/vitest`, stubs IntersectionObserver + ResizeObserver as no-ops). jsdom ships neither observer; SectionNavContext uses IntersectionObserver, charts use ResizeObserver, so full pages crash without the shims.
- FIXED a latent bug in `apps/geostat/vitest.config.ts`: the `@/` alias was `{find:'@/', replacement:'src'}` which drops the slash (`@/extensions/registry` → `srcextensions/registry`). Changed to `{find:'@', replacement:'src'}` to match vite.config.ts. Vite's string-alias boundary matches `@` and `@/...` but NOT `@statdash`/`@testing-library` (needs `/` right after), and the `@statdash/*` aliases precede it in the array.
- Test isolation: add `afterEach(cleanup)` from @testing-library/react. Without it, a prior test's DOM leaks and a missing element can false-pass via a sibling's render.

See the working example: `apps/geostat/src/data/second-tenant.fitness.test.tsx` (the [[second-tenant-fitness]] DoD test).
