---
name: frame-system-not-a-smell
description: AppChrome data-frame is NOT the closed-switch smell — frame dispatch is the open CSS attribute-selector cascade; a frame-strategy registry was rejected as YAGNI
metadata:
  type: project
---

ADR-0029 §6 "everywhere lens" item 3 ("AppChrome data-frame geometry switch → maybe a frame-strategy registry") was investigated (2026-06) and resolved to: **NOT the smell — do not build a registry.**

**Why:** The frame pathway is branch-free in code. `packages/plugins/chrome/AppChrome.tsx` reads `usePageFrame()` and emits one attribute `<div className="app-shell" data-frame={frame}>` — no switch/if over named frames. `FrameContext.tsx` is an open `createContext<string>('default')`; frame names live only in a doc comment captioned "convention, not closed union". `LocaleGuard.tsx:35` resolves `frame` by `??` null-coalescing of config, not branching. `node.ts:199` `frame?: string` is an open string. Grep of every frame literal (`'landing'|'minimal'|'canvas'|'full-width'`) across packages+apps = only doc comments, page-meta `defaults` data, round-trip tests, and **CSS `[data-frame="..."]` selectors** — zero code branches.

Geometry adaptation already dispatches through the DOM-attribute → CSS-selector cascade (e.g. `landing.css` `.app-shell[data-frame="landing"]{...}`), co-located with the owning page plugin. **Adding a new frame already needs ZERO AppChrome/engine edits**: page meta declares `frame: 'x'` (data) + owning plugin ships co-located `[data-frame="x"]` CSS. Already OCP-clean by construction — the property the presentation reshape had to CREATE, this has by design ("zero frame-aware JS — CSS cascade only").

**How to apply:** A strategy registry around a single `data-frame={frame}` attribute write adds contract+registry+resolver+test to guard a switch that does not exist and cannot regress — ceremony, no OCP gain = YAGNI. Hold this line if asked to "apply the presentation reshape to AppChrome". The cheap optional guard is a fitness test asserting AppChrome stays branch-free (no `switch`/`===` over frame names), not a registry. The real §6 follow-up is item 2 (`buildStaticContext` per-field defaulting), a true code switch. See [[project-presentation-registry]], [[registry-over-special-case]].
