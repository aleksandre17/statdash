# Board 02 — §I Accessibility / WCAG 2.1 AA (RX-21..24)

> Part of [Board 02 index](02-react.md). Analysis only. Be critical: green ≠ correct.

### [RX-21] Perspective-bar — PARTIAL ARIA-tabs pattern (keyboard-incomplete)
- **Status**: 🟡PARTIAL
- **Evidence**: `plugins/nodes/perspective-bar/default/PerspectiveBarShell.tsx:19-34`
- **What & why**: The perspective toggle renders `role="tablist"` + `role="tab"` + `aria-selected` + `aria-label` — the visible half of the WAI-ARIA Tabs pattern.
- **Critical analysis**: The flagged item, **genuinely incomplete** against WAI-ARIA APG Tabs: (1) **no roving tabindex** — every tab is in the tab order (should be `tabIndex={selected?0:-1}`); (2) **no arrow-key handler** — Left/Right/Home/End must move selection, absent (`onClick` only); (3) **no `aria-controls`** linking tab→panel, and **no `role="tabpanel"`/`aria-labelledby`** on the switched content; (4) icons use `data-icon`+`aria-hidden` (correct). **Crucially the engine a11y gate (`__tests__/a11y.test.tsx`) does NOT cover this** — it registers its OWN minimal slices and walks the *test's* registry, not real plugin shells. And axe-core **cannot detect** missing roving-tabindex/keyboard handlers (manual SC 2.1.1 checks). So this passes any axe gate while failing keyboard users — textbook metric-green ≠ correct.
- **Reference platforms**: Radix Tabs, Reach Tabs, GOV.UK tabs (all full APG keyboard). **Where WE beat them**: nothing — below their bar on keyboard a11y; must reach parity.
- **Foresight (multi-tenant)**: Perspective-bar is on every multi-perspective page; a keyboard-inaccessible primary control is a blanket WCAG 2.1.1 (Keyboard, Level A) failure across the platform.
- **Plan**: (1) Roving tabindex + Arrow/Home/End handler; (2) wire `aria-controls` + `role="tabpanel"`/`aria-labelledby` on the switched content — OR, if the bar only sets a URL param with no adjacent panel, switch to `radiogroup` (the more honest pattern); (3) add an **interaction** test (fireEvent keyboard), not just axe. Files: `PerspectiveBarShell.tsx`, new `PerspectiveBarShell.a11y.test.tsx`. Effort **S**, risk **two-way**, Class **M**, priority **P1**.
- **Raises-the-bar**: Full APG keyboard pattern on the most-used control, with an *interaction* gate.

### [RX-22] Plugin shells have NO co-located a11y gates
- **Status**: ⛔NOT-DONE
- **Evidence**: `find platform/packages/plugins -name "*a11y*"` → **empty**; the only a11y tests are `react/src/engine/__tests__/a11y.test.tsx` (engine-internal minimal slices) + `react/src/components/data/ChartDataTable.a11y.test.tsx` (react-layer table)
- **What & why**: The engine a11y fitness function asserts the *engine* renders accessible HTML but explicitly cannot import plugin shells (Law 3) and registers stand-in slices. The real shells — chart, section, kpi-strip, table, filter-bar, perspective-bar, map, gauge, hero, stats-carousel — have **zero axe gates**.
- **Critical analysis**: The broadest a11y debt. The doc comment in `a11y.test.tsx:13-17` *promises* "concrete plugin shells get their own a11y gates co-located (e.g. ChartDataTable.a11y.test.tsx)" — but that promise is unfulfilled (ChartDataTable is a react-layer component, not a plugin shell). The platform's actual rendered output is **untested for accessibility**. Every shell could regress (missing `scope`, unlabeled controls, contrast) and CI stays green. For a Law-9 platform this is the single largest integrity gap in this slice.
- **Reference platforms**: GOV.UK Design System (axe + manual a11y per component), Adobe Spectrum, Carbon. **Where WE beat them**: nothing — they all gate every component; we gate the engine abstraction but not the shells users see.
- **Foresight (multi-tenant)**: Tenants inherit our shells; one inaccessible shell = every tenant ships a violation. Reputational + legal (public-sector accessibility law).
- **Plan**: Add a single plugin-level **discovery** a11y gate that imports the real plugin registry and walks every registered shell through renderNode + axe (mirroring the engine gate but with real shells, which IS allowed inside `packages/plugins`); supplement with co-located interaction tests for keyboard-pattern shells (RX-21). Files: `plugins/__tests__/shells.a11y.test.tsx`. Fitness: axe + interaction per shell. Effort **L**, risk **one-way** (surfaces real violations to fix), Class **M**, priority **P1**.
- **Raises-the-bar**: Discovery-based a11y gate over the REAL shell registry — the engine gate generalized to production shells.

### [RX-23] No `prefers-reduced-motion` anywhere
- **Status**: ⛔NOT-DONE
- **Evidence**: `grep prefers-reduced-motion platform/packages` → **empty**; `styles/src/css/animations.css` + `tokens/animation.ts` exist with no reduced-motion guard; ApexCharts animates by default
- **What & why**: The platform has an animation token system + CSS animations + ApexCharts default entrance/update animations, with **no `@media (prefers-reduced-motion: reduce)`** anywhere and no Apex `animations.enabled:false` honoring the OS setting.
- **Critical analysis**: WCAG 2.3.3 is AAA, but 2.2.2 (Pause/Stop/Hide) is AA and vestibular safety is baseline for public-sector. Chart entrance animations + smooth-scroll anchor nav (RX-11) firing regardless of the user's reduced-motion preference is a real harm vector. Easy to fix, currently absent.
- **Reference platforms**: GOV.UK, Apple HIG, Grafana (all respect reduced-motion). **Where WE beat them**: none — table stakes we're missing.
- **Foresight**: Trivial now; expensive to retrofit across many animated shells later.
- **Plan**: (1) Global `@media (prefers-reduced-motion: reduce){ *{animation-duration:.01ms!important;transition-duration:.01ms!important} }` baseline in `animations.css`; (2) thread `prefersReducedMotion` into Apex options (`animations.enabled`); (3) gate anchor smooth-scroll (RX-11). Files: `styles/src/css/animations.css`, `ApexRenderer.tsx`, `AnchorNavContext.tsx`. Fitness: CSS-presence lint + Apex options test. Effort **S**, risk **two-way**, Class **G**, priority **P1**.
- **Raises-the-bar**: Motion-safe by default across charts, scroll, and transitions.

### [RX-24] Engine a11y discovery gate (the part that IS done)
- **Status**: ✅DONE
- **Evidence**: `react/src/engine/__tests__/a11y.test.tsx:199-219` (discovery-based: walks every registered type through renderNode + axe)
- **What & why**: For the engine's own registered types, a discovery loop renders each through the real pipeline and runs axe — a newly-registered type is auto-covered. Asserts the *engine machinery* produces accessible semantic HTML.
- **Critical analysis**: The discovery pattern is excellent and is the template for RX-22. Its limitation (acknowledged in-file) is it tests engine stand-in slices, not plugin shells — so this card is DONE for what it covers, but its coverage scope is the root of RX-22's gap.
- **Reference platforms**: jest-axe discovery suites. **Where WE beat them**: discovery-based auto-coverage (new type → auto-gated) is more robust than hand-listed component tests.
- **Foresight**: Reuse this exact pattern at the plugin layer (RX-22).
- **Plan**: Template for RX-22 (clone into plugins with the real registry). Effort **—** (covered by RX-22), priority **P1**.
- **Raises-the-bar**: Auto-covering a11y discovery gate.
