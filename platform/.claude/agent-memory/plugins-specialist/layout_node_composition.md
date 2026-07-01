---
name: layout-node-composition
description: How sections/pages compose via layout nodes — nav-transparent requirement, generated page-config schema, page-body stack, one grid primitive
metadata:
  type: project
---

The platform composes page/section STRUCTURE through layout-node primitives
(`packages/plugins/nodes/layout/**`: columns/grid/stack/card/divider/spacer/wrap).
Landed the owner's #1 ask (uniform layout-node composition) in commits adcc0de + 367e7e9.

**Why:** the recurring owner complaint was bespoke `<div>`s with inconsistent
handwriting + two competing grid primitives. Canonical design = `platform/work/DESIGN-responsive-composition.md`.

**How to apply — the load-bearing, non-obvious facts:**

- **Nav is CONFIG-driven, one-level descent via the `nav-transparent` cap.**
  `SiteRenderer.tsx` (`navSections` useMemo) reads `page.children` (raw config),
  then `navUtils._extract` descends EXACTLY ONE level into a container ONLY IF
  its registry cap includes `nav-transparent`, emitting `nav-contributor`
  children (section/geograph). A render-time wrapper (e.g. the page-body stack
  in InnerPageShell) does NOT affect nav — only config nesting does.
  → Any layout container that may wrap sections in CONFIG (columns/grid/stack)
    MUST declare `caps: ['nav-transparent']` in its `meta.ts`, else nested
    sections silently vanish from the page nav. (columns previously had caps:[]
    — a latent gap for gdp's columns-nested sections; now fixed.)

- **`packages/contracts/schema/page-config.schema.json` is a GENERATED artifact.**
  Regenerate after ANY node schema/roster change: `cd packages/react && pnpm run gen:schema`
  (script `scripts/emit-page-config-schema.ts`; also imports the meta roster, so
  a retired node must be removed from that script's import list too). A stale
  schema is caught by typecheck (script import) — regenerate, don't hand-edit.

- **Page body = the `stack` primitive.** `InnerPageShell` renders children inside
  `.layout-stack[data-dir=column]`; `.page-content` is viewport CHROME only
  (measure `--page-measure`, fluid gutter, margin). Arrangement + gap live on the
  stack. `.page-content__stack` = `flex:1 1 auto; min-height:0` (fill chain).

- **ONE grid primitive.** The `row` node + `.panel-row` (viewport-media, 1280px)
  are retired; use the container-query `columns`/`grid` family. Equal-height is
  intrinsic (`align-items:stretch` on `.layout-columns`/`.layout-grid`) — asserted
  once. `align` is authorable (schema `align` field → `data-align`, default
  `stretch`). Guards: FF-NO-DEAD-CAPABILITY, FF-NO-DUP-COLUMN-PRIMITIVE,
  FF-NO-BESPOKE-SECTION-DIV.

- **Fill chain is layered + orthogonal.** Resolver/CSS part is ours
  (`.page-content__stack`, panel-layout.css `.panel-col` chain, node-styles.css
  `[data-height]`/`[data-aspect]` → view → `.chart-wrap`); the ApexCharts
  `height:'100%'` config is the DEBUGGER lane's file — leave that seam alone.
