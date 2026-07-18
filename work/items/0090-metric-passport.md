---
id: "0090"
title: "THE METRIC PASSPORT — every governed noun shows what made it a metric (owner-caught opacity)"
status: QUEUED (2026-07-18, owner verbatim: «არსად ჩანს ობექტი, როგორ გამოიყურება მისი JSON — რა კონფიგურაციამ აქცია მეტრიკად»; fires after 0087/0089/0088 per the queue)
class: S-M
priority: P0
owner: lead → build agent (Opus)
implements: semantic-layer transparency canon — Looker «go to LookML» · Power BI measure DAX visible · dbt docs metric definitions · pairs with the wire-truth pane (0085) and the EXPLAIN seam (E4)
links:
  - platform/apps/panel/src/discovery/MetricPalette.tsx        # the tiles — gain the inspect affordance
  - platform/apps/panel/src/studio/model/MetricCatalogManager.tsx  # the steward definition seam (reuse)
---
**The build (plane-layered):**
1. **Author plane — the PASSPORT card:** every metric tile/summary gains an inspect affordance («ℹ» / long-press) opening a compact card: governed name (ka/en) · unit · SOURCE (the cube it reads, governed title) · the formula IN WORDS for calc metrics (a friendly rendering of `calc.expr` + inputs — e.g. «მშპ-ის ზრდა = მშპ ÷ წინა-წლის მშპ − 1», derived from the def, never hand-written) · where-used count if cheap (page/element references). No JSON, no raw codes (plane law).
2. **Steward plane — the DEFINITION view:** additionally the raw `MetricDef` JSON (pretty, dark-safe per the 8d86baf class) + the LOWERING: `resolveMeasureRef` → the raw codes/datasets it expands to (the SSOT derivation, never re-implemented) + a one-click «გახსენი კატალოგში» into the existing MetricCatalogManager for editing (REUSE — no second editor).
3. **Honest states:** a base metric shows «პირდაპირი კოდი: X კუბიდან Y»; a promoted metric shows its provenance (promoted from raw, date) if the catalog carries it — never invented.

**Boundaries.** Read-only surface (editing stays in the catalog manager) · one derivation (def → passport via the engine registry/describeApp; expr-to-words via the ONE expr AST, not a regex) · plane law verbatim · bilingual, WCAG · dark-safe.

**DoD.** Live: author clicks ℹ on «მშპ-ის ზრდა (წლიური)» → the passport reads correctly in words; steward sees the MetricDef JSON + the lowered codes; «გახსენი კატალოგში» lands on the definition; zero console errors; panel gate green; screenshots.
