---
name: export-menu-and-section-scope
description: ExportBar→ExportMenu (icon+dropdown in section header) + NodeExportContext = the section-scoped rows publish/subscribe seam (EXPORT twin of NodeStatusContext)
metadata:
  type: project
---

Data-export UI redesign (branch `feat/export-icon-dropdown`, commit caa58ce) — geostat admin: per-panel ExportBar (one text button PER format, dozens/page) "takes too much space".

**What shipped:**
- `ExportBar` → **`ExportMenu`** (`packages/react/src/components/feedback/ExportMenu.tsx`): ONE compact download-icon menu-button, WAI-ARIA menu pattern (aria-haspopup=menu/aria-expanded/localized aria-label `export.toolbar`; role=menu / role=menuitem per registered format `export.download`; Enter/Space/ArrowDown open+focus-first, Arrow roving, Escape close+return-focus, click-outside). Token `EXPORT_BAR`→**`EXPORT_MENU`**. `.export-bar` CSS retired → `.export-menu`. `triggerClassName` prop lets the host pass `section__icon-btn` so the glyph matches sibling header icons.
- Placement: **section header actions row**, sibling of copy-link permalink (`SharePermalinkButton`, a SECTION_HEADER_ACTIONS extension) + info + view-toggle. Rendered via new `SectionExportMenu` (section plugin) — isolated so `useInject(EXPORT_MENU)` only runs when there's an export.
- Download path UNCHANGED: onExport → `data:export` bus → `downloadExport` (CSV BOM / xlsx OOXML intact).

**The reusable seam — `NodeExportContext.tsx` (packages/react/engine):** the EXPORT twin of [[project_i18n_integrity_ar37_ar39]]'s NodeStatusContext, and the exact Option-D rows-aggregate consumer SectionShell's ADR reserved (was YAGNI, now real).
- `useReportPanelExport(nodeId, rows, meta)` — panels PUBLISH {rows,meta} up; visibility-gated (reuses NodeVisibilityContext → toggled-hidden view clears, only on-screen slice exports); empty-rows clears; returns `scoped` (false ⇒ Postel inline-menu fallback for standalone panels).
- `useExportScope()` → `{ collector, hasExport, readActive }`. Section owns the scope (NOT the page — export is per-section, Law 9; unlike NodeStatus which moved UP to page in AR-40). **Loop-safe: PRESENCE in React state (mount/unmount/visibility only), ROWS in a ref read at CLICK via readActive()** — a churning ctx.rows identity never loops.
- Type `PanelExportData` (deliberately NOT `PanelExport` — that's the component name in the main barrel; two barrels, avoid the name clash).
- Panels: ChartShell/TableShell/GaugeShell render `<PanelExport ctx rows meta nodeId={def.id}/>` (was `PanelExportBar`). eslint DI static-components exception path updated.

i18n: reused existing `feedback` keys `export.toolbar`/`export.download` (en baseline in geostat feedback.ts; ka via manifest catalog) — zero new keys, no leak.
