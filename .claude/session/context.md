# Session context — in-progress blackboard

> Rotate when > 150 lines or layer transition. Extract decisions → opus-brief.md, clear this file.

## Completed: Plugin taxonomy Phase 2 ✅
- `slice-meta.ts` — `SliceCategory` + `PageSliceMeta` / `PanelSliceMeta` / `NodeSliceMeta` split
- `catalog.ts` — `PaletteEntry` + `PluginCatalog` + `PLUGIN_CATALOG` structured index
- `NodeRegistry.ts` — `list()` + `getSchema()` for Constructor introspection
- 21 plugin META annotated; `page-header.category` fixed (`'chrome'` → `'content'`)

## Completed: @geostat/styles — full expansion ✅

### Typography, color, background, border, pseudo-states (session 1)
- `types.ts` — `NodeStyles` expanded: typography (fontSize, fontWeight, fontFamily, lineHeight, letterSpacing, textAlign, textTransform, textOverflow, whiteSpace, color), background (backgroundColor, background, backgroundImage, backgroundSize, backgroundPosition), border (border, borderRadius, borderColor, borderWidth, borderStyle, boxShadow), minWidth, maxWidth, display, flexDirection, flexWrap, alignItems, justifyContent, flex, flexGrow, flexShrink, flexBasis, position, top, right, bottom, left, zIndex, cursor, pointerEvents, userSelect; `PseudoStyles` (hover/focus/active — data-attr + CSS-var, Option A); `ColorValue`
- `tokens.ts` — `FONT_SIZE`, `FONT_WEIGHT`, `LINE_HEIGHT`, `LETTER_SPACING`, `FONT_FAMILY`, `COLOR`, `Z_INDEX` constants
- `css/tokens.css` — typography + semantic color CSS vars
- `resolvers/node.ts` — `applyNodeStyles` handles all new fields; `applyPseudo()` for pseudo-states
- `css/node-styles.css` — `[data-hover]:hover`, `[data-focus]:focus-visible`, `[data-active]:active` blocks
- `tokens-catalog.ts` — split to `catalog/` barrel: `layout.ts`, `typography.ts`, `color.ts`, `types.ts`

### 6-point breakpoint scale + container queries + dark mode (session 2)
- `BREAKPOINTS` → xs:480 / sm:640 / md:768 / lg:1024 / xl:1280 / 2xl:1536 (md moved 960→768)
- `ResponsiveVal<T>` / `ResolvedResponsive<T>` expanded to 6 keys
- `resolve.ts` — `resolveResponsive` detects all 6 breakpoint keys via `BREAKPOINT_KEYS` SSOT
- `css/tokens.css` — dark mode Option C: `@media (prefers-color-scheme: dark)` + `[data-theme="dark"]` overrides
- `css/node-styles.css` — `@container` blocks alongside `@media` for `[data-aspect]` cascade; `@media print` for `[data-print-hide]`
- New NodeStyles fields: `overflowX`, `overflowY`, `visibility`, `transform`, `transformOrigin`, `filter`, `backdropFilter`, `isolation`, `objectFit`, `objectPosition`, `printHide`
- `catalog/layout.ts` — 6-point breakpoint descriptors

### Full per-breakpoint responsive delivery (session 3)
- `resolvers/node.ts` — `setResponsive()` helper: Option A (CSS-var cascade, mutually exclusive from inline to avoid specificity override); ~35 responsive props converted; `data-<prop>-responsive` presence flags
- `css/node-styles.css` — 38 per-property `[data-*-responsive]` media-query cascade blocks (6 breakpoints each), falling through to larger values
- `resolvers/layout.ts` — `applyContainerVars` now emits `--layout-gap-<bp>` vars when gap is responsive; `resolveColumns` expanded to 6-point return type
- `plugins/nodes/layout/columns/default/ColumnsShell.tsx` — emits `data-cols-xl/lg/xs` attrs
- `plugins/nodes/layout/layout.css` — 6-point container queries (xs/sm/md/lg/xl + grid); `md` corrected 960→768; `container-type: inline-size` on `.layout-stack`
- `plugins/nodes/section/default/section.css` — `container-type: inline-size` on `.section`

## Active layer: 2.9 — Engine → DB DataStore
Status: `stats-api.ts` + `site-manifest.ts fetchStats()` built. Next: verify VITE_STORE_MODE=stats wires end-to-end.

## Open follow-up (styles)
- `resolvers/node.ts` ESLint: `_c` unused-var suppress comment at applyViewStyles (intentional destructuring, inline-disable added)
- Shells that need `container-type: inline-size`: only columns + section done; grid/row/wrap may benefit when they gain scroll/overflow variants
- `applyTokens()` in `@geostat/react` — verify it exists and is wired in geostat bootstrap for Phase 2 token delivery
