# Board 02 — §G Layout + §H i18n (RX-18..20)

> Part of [Board 02 index](02-react.md). Analysis only.

## §G — Layout / container-queries / responsive

### [RX-18] Container-query-driven responsive layout
- **Status**: ✅DONE
- **Evidence**: `@container`/`container-type` in `plugins/nodes/layout/layout.css`, `plugins/nodes/section/default/section.css`, `styles/src/css/card.css`, `styles/src/css/node-styles.css`; `mergePlacement` ([[project_disclosure_placement_seams]])
- **What & why**: Layout responds to **container** size, not viewport — so a chart in a narrow column and the same chart full-width adapt independently. `mergePlacement` provides typed layout-item style merge. Modern (2023+) responsive primitive.
- **Critical analysis**: Container queries are the right call — viewport media-queries can't handle a config-driven grid where the same node lands in arbitrary column widths. Strong. Risk: **no `@supports (container-type)` fallback** for older browsers (Safari <16) — on unsupported browsers layouts may collapse. For a government/public-stats platform (Law 9 broad-access), long-tail browser support matters more than for SaaS.
- **Reference platforms**: Webflow (viewport breakpoints), Grafana grid (px react-grid-layout), Tableau (fixed dashboards). **Where WE beat them**: container-query layout is more compositional — a node is responsive wherever it's dropped, no per-placement config.
- **Foresight (multi-tenant)**: Embeddable widgets (a section embedded in a tenant CMS at unknown width) only work correctly with container queries — a real competitive edge for embed scenarios.
- **Plan**: Add `@supports not (container-type: inline-size)` viewport-media fallback for core layout/section CSS. Files: `layout.css`, `section.css`. Fitness: a CSS-presence lint asserting fallback exists. Effort **S**, risk **two-way**, Class **G**, priority **P2**.
- **Raises-the-bar**: Drop-anywhere container-responsive nodes — embeddable at any width.

### [RX-19] Layout/disclosure/placement hook seams
- **Status**: ✅DONE
- **Evidence**: `react/src/engine/hooks/{useCollapsible,useViewToggle,useDisclosure,useNodeTemplate}.ts`; `accentStyle.ts`; `viewStateKey.ts`; [[project_shell_ui_hooks_shared]], [[project_node_template_seam]], [[project_disclosure_placement_seams]]
- **What & why**: Shared UI-state hooks in the react engine (NOT in any plugin slice): `useCollapsible`, `useViewToggle` (de-section-ed via `keyNamespace`), `useDisclosure` (minimal toggle), `useNodeTemplate`/`resolveNodeTemplate` (the ONE canonical template-resolution seam with `{...filterParams,...vars}` merge). Renderer-hooks rule honored ([[feedback_renderer_hooks]]): hooks → inner component wrapper, never called from a plain render fn.
- **Critical analysis**: Exemplary — the hooks are genuinely generic (keyNamespace-parameterized, no section/app coupling) and centralized so shells don't hand-roll merge/`{`-guard logic. `resolveNodeTemplate`'s string-input overload killed a `title!` assertion. Verified these live in engine/hooks, not plugins. No deficiency; the only watch-item is hook proliferation — at ~6 shell hooks a `useShellState` composite could emerge, but that's premature.
- **Reference platforms**: Radix primitives (`useControllableState`), Headless UI hooks, Grafana `usePanelContext`. **Where WE beat them**: ours are config-render-aware (template/var-merge), not just UI-state — Radix hooks know nothing about a render pipeline.
- **Foresight**: Tab/wizard/stepper shells will reuse `useDisclosure`/`useViewToggle` — the seams are ready.
- **Plan**: No action. Re-audit if hook count exceeds ~10 (composite-hook signal). Effort **—**, priority **P3**.
- **Raises-the-bar**: Centralized, namespace-parameterized shell-state hooks shared across all slices.

## §H — i18n

### [RX-20] i18n compose-boundary (LocaleString, useT, useResolveLocaleSafe)
- **Status**: ✅DONE (🟡 RTL/ICU missing)
- **Evidence**: `react/src/context/SiteContext.tsx:182-225` (useFmt/useResolveLocale/useResolveLocaleSafe/useT); `react/src/index.ts:68` (exports)
- **What & why**: Three resolution tiers: `useResolveLocale` (content `LocaleString`, memoized on locale+fallback), `useResolveLocaleSafe` (non-throwing, degrades to `'en'` outside `<SiteProvider>` — Postel for context-optional components like StatusBadge), `useT(ns)` (system UI strings via i18next namespace), `useFmt` (number/date formatter, O(1) registry lookup). De-tenanted: `DEFAULT_LOCALE_FALLBACK='en'` (old D-2 `'ka'` debt resolved).
- **Critical analysis**: Clean three-tier model (content vs UI-chrome vs format). `useResolveLocaleSafe`'s graceful degradation is right for stories/isolated tests. Old project-debt D-1/D-2 (Georgian literals, `ka` default) appear resolved in the agnostic layer — default is now `'en'`, guarded by `no-tenant-content.fitness.test.ts`. Concern: `useT` calls `i18next.t` directly — i18next is an **optional peer** (the a11y test mocks it), so a shell using `useT` outside an i18next-initialized app gets the raw key back silently. No **RTL/bidi** handling (`dir="rtl"`) — an international stats platform (Arabic/Hebrew tenants) future gap. No **ICU MessageFormat/pluralization** evidence beyond i18next built-in.
- **Reference platforms**: FormatJS/react-intl (ICU MessageFormat), i18next, Lingui. **Where WE beat them**: the `LocaleString` content model (per-field `{en,ka,…}`) lives in the *config/data*, so translations are authored in the Constructor WITH the content — not in separate locale JSON divorced from data. A genuine editorial-workflow edge over react-intl.
- **Foresight (multi-tenant)**: Multi-locale tenants need RTL + ICU plurals. `LocaleString` scales; the missing piece is `dir` resolution from locale + ICU formatting in `useFmt`.
- **Plan**: (1) `useDir()` deriving `dir` from locale (RTL set), thread to root; (2) confirm/extend `useFmt` ICU plural support; (3) document `useT` no-i18next degradation. Files: `SiteContext.tsx`, `index.ts`. Fitness: RTL snapshot + `no-tenant-content` stays green. Effort **M**, risk **two-way**, Class **M**, priority **P2**.
- **Raises-the-bar**: Content-co-located translations (LocaleString in config) + Constructor-authored i18n.
