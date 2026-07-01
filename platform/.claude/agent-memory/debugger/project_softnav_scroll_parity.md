---
name: softnav-scroll-parity
description: "table still broken" soft-nav≠hard-load was a scroll-restoration artifact, not layout; DOM probes hard-load (scrollY 0) and structurally cannot see it
metadata:
  type: project
---

The recurring "table still broken on soft-nav" reports were NOT a layout/measurement bug.

**Diagnosis (2026-07-01, live :3002):** measured + pixel-diffed hard-load vs soft-nav for `/ka/regional` and `/ka/gdp` across 1920/1600/1440/1280/768, default AND table-toggled, home→inner and inner→inner. DOM was byte-identical every time (grids, bands, `--panel-ratio`, sticky thead, column widths, scrollWidth all equal; screenshots differed by 2-4 bytes). The ONLY divergence: **window scroll offset.** Hard-load lands at `scrollY=0`; soft-nav preserves the outgoing route's scroll, so the incoming page renders mid/bottom-page (header/KPIs/map scrolled out, sticky filter bar floating over clipped content) — which reads as "broken."

**Root cause:** classic `<BrowserRouter>` SPA with NO scroll reset on route change (react-router's data-router `<ScrollRestoration>` isn't available on the classic router). Fixed with `RouteScrollManager` (packages/react/src/engine) mounted in RendererSurface: scroll-to-top on pathname change, scroll-to-#anchor when the URL carries a hash (also closed the latent dropped cross-page anchor from `useSidebarNav` navigate(path#id)). Keyed on pathname+hash only, so filter/perspective search-param changes never yank scroll.

**Why:** the trap is methodological — every DOM/screenshot probe navigates via `page.goto()` (a HARD load → scrollY 0 → always looks correct), while the owner SOFT-navigates from a scrolled page. A whole class of soft-vs-hard bugs (scroll, leaked route state, mount-order) is invisible to a goto-only probe.

**How to apply:** when a bug reproduces for the owner but never for probes, replicate the SOFT path — `page.goto(home)` → scroll → click an in-app link → measure — and diff against the goto path. Don't trust hard-load probes to represent what the user sees after client-side navigation. See [[cachedstore-async-gap]] for another "probe saw one path, prod took another" case.
