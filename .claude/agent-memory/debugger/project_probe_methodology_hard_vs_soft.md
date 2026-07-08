---
name: probe-methodology-hard-vs-soft
description: A whole class of live bugs (scroll, leaked route state, theme-at-first-paint, mount-order) is invisible to goto-only probes because page.goto() is a HARD load — but the owner SOFT-navigates from a scrolled page. Merged from two solved cases (soft-nav scroll parity, dark-mode choropleth theme-frozen). Recurs whenever a bug reproduces for the owner but never for the probe.
metadata:
  type: project
---

## The methodology trap (the durable lesson)
Every DOM/screenshot probe navigates via `page.goto()` = a HARD load (scrollY 0, fresh document, attributes applied). The owner SOFT-navigates via in-app links from an already-scrolled, already-themed page. A hard-load probe **structurally cannot see** soft-nav-only bugs and always looks correct. When a bug reproduces for the owner but never for a probe, **replicate the SOFT path**: `page.goto(home)` → scroll / seed localStorage → click an in-app link → measure, and diff against the goto path. Don't trust hard-load probes to represent what the user sees after client-side navigation.

## Two fixed cases in this class

**1. Soft-nav ≠ hard-load was a SCROLL-restoration artifact, not layout.** Recurring "table still broken on soft-nav" reports: DOM was byte-identical hard vs soft across every breakpoint/toggle (grids, bands, sticky thead, column widths all equal; screenshots differed 2-4 bytes). The ONLY divergence was window scroll offset — hard-load lands at `scrollY=0`; soft-nav preserves the outgoing route's scroll, so the incoming page renders mid/bottom (header/KPIs scrolled out, sticky filter bar floating over clipped content) = reads as "broken." Root: classic `<BrowserRouter>` with NO scroll reset on route change (data-router `<ScrollRestoration>` isn't available on the classic router). Fix: `RouteScrollManager` (`packages/react/src/engine`, mounted in RendererSurface) — scroll-to-top on pathname change, scroll-to-#anchor on hash; keyed on pathname+hash ONLY so filter/perspective search-param changes never yank scroll.

**2. Theme applied POST-PAINT → cssVar-at-render captures the wrong token (dark-mode only).** Regional choropleth showed different region fills hard-refresh vs soft-nav, ONLY in dark mode. Both roots needed:
- **D1 (fixed):** `useTheme` applied `data-theme` in a POST-PAINT `useEffect` (init from localStorage/OS). On hard-load the attribute is absent during first render → any `getComputedStyle`-at-render consumer captures the LIGHT `--color-surface` token; soft-nav already has the attribute from the prior route → captures DARK. (Also a dark-mode FOUC + affects every cssVar-at-render sink incl. Apex SVG fills.) Fix: apply `data-theme` SYNCHRONOUSLY before `createRoot().render()` (stored choice → OS pref), mirroring the existing synchronous `data-tenant` seam in `main.tsx`. Idempotent with useTheme's later effect.
- **D2 (OPEN — recommended, not done):** `GeoMap` `colorByGeo = useMemo(() => quantileColors(rows, sequentialRamp()), [rows])` — deps `[rows]` only; `sequentialRamp()` reads `--color-accent`/`--color-surface` via cssVar at memo-eval, but theme is NOT a dep → the ramp is FROZEN and never recomputes on any post-memo theme change (nav timing AND runtime toggle). Fix: add a theme-epoch signal (MutationObserver on `documentElement` `data-theme`/`data-tenant` + `matchMedia` change) to the memo deps; promote to a shared `@statdash/react` hook when charts need it. General rule: any `useMemo` that reads a cssVar/getComputedStyle must depend on a theme-epoch, not just its data deps.

**Method note:** repro required SEEDING localStorage `statdash-theme=dark` via `addInitScript`, then diffing hard-load vs click-navigated soft-nav fills. A goto-only probe hard-loads and shows light-mode SAME → misses it.
