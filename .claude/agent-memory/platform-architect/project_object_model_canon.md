---
name: project-object-model-canon
description: The canonical rendering-core object model — One Type System, One Tree, Two Residences + Promotion Law (SPEC-rendering-core-object-model.md, ADR-023 slated)
metadata:
  type: project
---

`docs/architecture/proposals/SPEC-rendering-core-object-model.md` (I am sole author, 2026-07-10) is the canonical answer to the owner's "why isn't the KPI card a first-class object" question — the deepest study in the platform; treat it as the object-model SSOT.

**Why:** owner's trigger = KpiSpec being a prop-array item vs KpiStripNode being a typed node; lead hypothesized "everything a first-class object in one tree". Study confirmed the direction but corrected the strong reading.

**The model:** ONE type system (`ObjectMeta` with kind FACETS — rootOnly/leaf/chrome/control as literal-pinned refinements; 5-tier SliceMeta union becomes derived aliases; one registry, chrome/control registries → facet-indexed views) + ONE tree + TWO residences (slot = node instances; field-with-itemSchema = typed values) + a **Promotion Law**: element needs ≥2 node facets {id-address, visibility, style, own DataSpec, RBAC, reorder} → MUST be a node type; below → value. Lineage: Figma kind-as-facet · Puck "slot is a field type / residence = property of the composition site" · Sanity one-schema-registry-across-bands · Grafana/Vega value-band canon (columns/encodings/params stay values).

**Key verified facts (cite, don't re-derive):**
- `registerSlice.ts:73` already collapses node/page/panel into ONE nodeRegistry — the 5-tier is META vocabulary, not five mechanisms; real debt = 3 registries + 2 composition mechanisms (SlotDef vs ChromeSlot) + unregistered item tier.
- `KpiSpec` reinvents node facets per-item (id, `when`=VisibilityExpr in a 2nd eval seam `kpiVisible`, color, preliminary/methodologyUrl); HeroCardDef repeats id/color — THE root cause (facet reinvention).
- Config never carries sliceType — type-system unification (R1) is pure engine-internal, zero config migration.

**Migration R0–R5:** R0 ADR-023+FFs · R1 ObjectMeta unification (byte-identical, alias-reversible) · R2 promote `kpi-card` (KpiValueSpec joins registerSpec → card = leaf data panel inheriting whole renderNode pipeline; interpretKpi strangled; expand-contract, contract = only one-way door D-ROM-2) · R3 hero-card + FF-NO-FACET-REINVENTION hard gate · R4 chrome residence (site-frame with region slots; DEFER until after SL-series) · R5 param/control split (DEFER, YAGNI — Grafana canon endorses current shape; M4.1 "no cross-tier slot" confirmed).

**Fold-ins:** D7/ADR-022 itemSchema = REFRAMED not superseded (permanent value-band editor; kpi/hero itemSchemas retire on promotion). [[project-shell-placement-law]] SPEC-studio-shell-layout RESUMES UNCHANGED — its scope axis maps 1:1 onto residence; unpause allowed pre-R1. [[project-deep-authorability]] gates stand.

**How to apply:** any new composable element → run the Promotion Law before choosing itemSchema vs node type; refuse new registries/composition mechanisms (kind = facet, composition = slot or itemSchema field); at Leader's Scans check R-phase progress and whether owner gated D-ROM-1/2.
