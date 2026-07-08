# Board 02 — §C Theming + variant + §D nav spines (RX-08..11)

> Part of [Board 02 index](02-react.md). Analysis only.

## §C — Theming / token spine + variant spine

### [RX-08] Semantic-token spine (300 tokens, dark-mode cascade)
- **Status**: ✅DONE (🟡 high-contrast tier missing)
- **Evidence**: `platform/packages/styles/src/css/tokens.css:324-409` (4-tier theme cascade); `styles/src/tokens/*.ts`; `tokens.parity.test.ts`
- **What & why**: 300 CSS custom properties, TS token catalog mirrored to CSS with a parity test. Four-tier theme resolution: base → `@media(prefers-color-scheme:dark)` → `[data-theme="dark"]` → `[data-theme="light"]` opt-out. Constructor/tenant sets `data-theme` on `<html>`; no attribute ⇒ system preference wins.
- **Critical analysis**: Genuinely strong — most dashboards hardcode a palette. The parity test is the right fitness function (TS↔CSS drift gate). Concern: 300 flat tokens with no documented **primitive vs semantic** layering in this slice — if `--color-bar-1` and `--color-text-primary` share a namespace, tenants can't retheme semantically without touching primitives. Verify a two-layer model (primitive → semantic alias). Dark mode exists but **no `prefers-contrast` high-contrast tier** — a WCAG 2.1 AA low-vision gap.
- **Reference platforms**: Radix Colors (12-step semantic scales), Tailwind theme tokens, Grafana theme.v2. **Where WE beat them**: 4-tier `data-theme` + system-preference cascade is cleaner than Grafana's JS-only theme object; CSS-native ⇒ SSR/print themes work with zero JS.
- **Foresight (multi-tenant)**: Each tenant wants its brand palette via `data-theme`; needs a **tenant-scoped override seam** remapping semantic aliases (not primitives) — the M-5 capability.
- **Plan**: (1) Audit primitive/semantic split; add a semantic-alias layer if flat; (2) add `@media(prefers-contrast:more)` tier; (3) document tenant-override CSS scope. Files: `tokens.css`, `tokens/color.ts`. Fitness: extend `tokens.parity.test.ts` + new `theme-tiers.fitness.test`. Effort **M**, risk **two-way**, Class **M**, priority **P2**.
- **Raises-the-bar**: CSS-native 4-tier theming with TS↔CSS parity enforcement.

### [RX-09] Variant spine (data-attr projection, zero modifier classes)
- **Status**: ✅DONE
- **Evidence**: `styles/src/resolvers/variant.ts:43-55`; [[project_variant_style_spine]]; `variant.test.ts`
- **What & why**: `resolveVariants(schema, authored)` translates a slice's declared variants + authored values → a `data-*` attribute bag the shell spreads. `flag` kind → presence attr; `enum` → attr value. CSS reads `[data-emphasis="hero"]`, never `.section--hero`. Section's `hero`/`compact` folded into one `emphasis` enum. `styleKeys` SSOT, v3→v4 migrator, FF-NO-VARIANT-CLASS gate.
- **Critical analysis**: Excellent ISP-clean design — variant schema is per-slice, not a bloated base ([[feedback_strict_solid_per_element]]). The `VariantDefShape` structural duck-type keeps `@statdash/styles` arrow-clean (imports nothing from react/engine). Gap: `resolveVariants` projects but does **not validate** — an authored enum value outside the declared options still emits `data-emphasis="bogus"` (no warn) and CSS silently no-matches. A render-time diagnostic (like `warnSlotPlacement`) is missing.
- **Reference platforms**: Tailwind `data-*` variants, Radix `data-state`, Stitches/CVA. **Where WE beat them**: Stitches/CVA generate classes at build; ours is runtime-zero data-attr projection driven by a declared schema the Constructor can READ — Constructor-ready variants, which CVA is not.
- **Foresight**: Constructor variant-picker reads the same schema; an invalid-value diagnostic becomes a Constructor validation surface.
- **Plan**: DEV-mode unknown-enum-value diagnostic in `resolveVariants` (or sibling `validateVariants`). File: `variant.ts`. Fitness: extend `variant.test.ts`. Effort **S**, risk **two-way**, Class **M**, priority **P2**.
- **Raises-the-bar**: Runtime-zero, schema-declared, Constructor-readable variants.

## §D — Capability-nav spine

### [RX-10] No-privileged-node nav (NavContribution descriptor)
- **Status**: ✅DONE
- **Evidence**: `react/src/engine/nav-contribution.ts`; `navUtils.ts`; `navOrderFromPerspectives.fitness.test.ts`; `no-privileged-node.fitness.test.ts`; [[project_no_privileged_node_nav]]
- **What & why**: Nav built from `nav-contributor`/`nav-transparent` capability caps + a `NavContribution` descriptor — no node type is privileged. `navOrderFromPerspectives` derives nav order from declared perspectives. `AnchorNavContext`/`DefaultPassthroughShell` renames done. FF-NO-PRIVILEGED-NODE guards regressions.
- **Critical analysis**: Strong OCP — a new nav-contributing type needs only the cap, not a navUtils edit. Fitness gates exist and are real. Concern: nav contribution is *structural* (walks the tree); no test that a **deeply nested** nav-contributor (inside a repeat node) contributes correctly — order derivation assumes top-level sections.
- **Reference platforms**: Grafana nav-model (privileged dashboard/folder types), Docusaurus sidebar (config-driven). **Where WE beat them**: Grafana's nav is hardcoded to dashboard/folder/panel; ours is capability-driven — any node contributes nav with zero engine change.
- **Foresight (multi-tenant)**: Custom page-section types get nav for free; nested/repeat contributors will appear and need a recursion test.
- **Plan**: Add a nested-nav-contributor fixture to `navOrderFromPerspectives.fitness.test.ts`. Effort **S**, risk **one-way**, Class **M**, priority **P3**.
- **Raises-the-bar**: Capability-driven nav with regression fitness gates — de-privileged by construction.

### [RX-11] Section-nav anchor system (AnchorNavContext)
- **Status**: 🟡PARTIAL
- **Evidence**: `react/src/context/AnchorNavContext.tsx`; doc `docs/architecture/subsystems/28-section-nav.md`
- **What & why**: In-page anchor navigation (scroll-to-section, active-section highlight) via context — the ONS/Eurostat "jump to section" pattern.
- **Critical analysis**: Context exists, but **no `IntersectionObserver` active-section tracking test** and no `prefers-reduced-motion`-aware smooth-scroll found. Smooth-scroll without honoring reduced-motion is a WCAG vestibular concern. Keyboard focus management on anchor-jump (moving focus to the target heading) is the accessible pattern — unverified. Classic "looks done, a11y-incomplete" (metric-green ≠ correct).
- **Reference platforms**: ONS section-nav, GOV.UK "contents" component (moves focus + honors reduced-motion), MDN sidebar. **Where WE beat them**: ours is config-derived from the node tree, not hand-authored per page.
- **Foresight**: Long publication pages need this keyboard- and SR-correct or it fails Law 9 audit.
- **Plan**: (1) Verify/add focus-move-to-heading on activation; (2) gate smooth-scroll behind `prefers-reduced-motion`; (3) add an interaction test. Files: `AnchorNavContext.tsx`, section nav shell in plugins. Effort **M**, risk **two-way**, Class **M**, priority **P1**.
- **Raises-the-bar**: Config-derived, accessibility-complete in-page nav.
