// ── builtins — the platform's dock sections (register once at import) ───────────
//
//  Registers the sections that make up the element + page dock bodies. Each is the
//  SAME content RightDock used to hardcode, now declared as a registry entry (§3.1).
//  Importing this module wires them (side-effect registration, like the value-mapping
//  control) — App boot imports it, tests import it explicitly.
//
//  Element context (selection = a node):   schema-groups → node-context → visibility
//  Element context (selection = chrome):    the chrome inspector panel (exclusive)
//  Page context (idle default):             page config → perspectives → filters
//
//  Order values leave gaps (10s) so an app can slot a section BETWEEN built-ins
//  (e.g. a Data/lineage section, §3.3) without renumbering — OCP.
//
import { Box, Chip, Button, Typography } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import type { VisibilityExpr } from '@statdash/engine'
import { nodeRegistry, facetRegistry } from '@statdash/react/engine'
import type { ObjectMeta } from '@statdash/react/engine'
import { Inspector } from '../Inspector'
import { VisibilitySection } from '../../features/visibility'
import { PageInspectorPanel } from '../../features/page-config'
import { PerspectivesPane } from '../../features/perspectives'
import { FiltersDrawer } from '../../features/filters'
import { fixedSchemaSource, itemTitle } from '../controls/nestedItemControl.helpers'
import { registerBuiltinFacets } from '../facets/builtinFacets'
import type { CanvasNode } from '../../types/constructor'
import { dockSectionRegistry, type DockRenderCtx } from './dockSection'

/** A page node is selected in the element context — the shared guard (a chrome region
 *  has no page `selected`; it is a bounded PART, covered by `partSelected`). */
const nodeSelected = (ctx: DockRenderCtx): boolean =>
  ctx.scope === 'element' && !!ctx.controller.selected

/** A bounded PART is the active selection — a value/filter band item OR a chrome region
 *  (owned by the site-frame, so no page `selected`). The generic item projection path. */
const partSelected = (ctx: DockRenderCtx): boolean =>
  ctx.scope === 'element' && !!ctx.controller.selectedBand

/** A WHOLE node is selected (no drilled band item) — the node-scoped sections. */
const wholeNodeSelected = (ctx: DockRenderCtx): boolean =>
  nodeSelected(ctx) && !ctx.controller.selectedBand

// ── BandItemHeader — the bounded child's crumb + a one-click return to its owner ──
//  Keeps the dock oriented (which strip · which card) while the body shows ONLY the
//  item's own contract. "Back" reselects the owning node (whole-strip authoring),
//  never disturbing the page or canvas beyond the selection.
function BandItemHeader(
  { parentType, title, onBack }: { parentType: string; title: string; onBack: () => void },
): React.ReactNode {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
      <Button
        size="small"
        onClick={onBack}
        startIcon={<ChevronLeftIcon fontSize="small" />}
        sx={{ minWidth: 0, px: 0.75, textTransform: 'none' }}
      >
        {parentType}
      </Button>
      <Typography variant="body2" color="text.secondary" aria-hidden="true">›</Typography>
      <Chip size="small" label={title} color="primary" variant="outlined" />
    </Box>
  )
}

let registered = false

/** Idempotently register the built-in dock sections. Safe from boot + tests. */
export function registerBuiltinDockSections(): void {
  if (registered) return
  registered = true

  // Register the platform's built-in FACETS first, then derive one generic dock
  // section per facet (the facet-axis projection — see registerFacetSections).
  registerBuiltinFacets()
  registerFacetSections()

  dockSectionRegistry
    // ── ELEMENT · schema groups (the generic Inspector + its type chip) ──────────
    //  ONE section, TWO bounded projections over the SAME generic Inspector — the
    //  selection ADDRESS decides which declared contract it renders (ADR-038):
    //    • a whole node   → the node's own PropSchema (via nodeSchemaSource);
    //    • a value-band item (a declared child) → ONLY that item's own `itemSchema`,
    //      resolved generically from the node's declaration (selectedBand), written
    //      through the item write path. Bounded by construction — the strip's other
    //      cards and the array band never appear, so the dock FITS. No per-type
    //      branch: the item's schema is its declaration, not a hand-wired form.
    .register({
      id:        'element.schema',
      order:     10,
      appliesTo: (ctx) => nodeSelected(ctx) || partSelected(ctx),
      render:    (ctx) => {
        const { selected, selectedBand, patchProp, patchItemProp, selectNode } = ctx.controller

        if (selectedBand) {
          // The item's live object + write both come from the RESOLVED selection (its
          // owning element's declared part), not a direct `selected.props` reach — so a
          // page-owned band (filters) projects from the filterSchema SSOT, a props band
          // from node.props, and a CHROME region from the site.chrome SSOT, through the
          // SAME bounded projection (ADR-038/039 · S6). The owning element is carried on
          // the part (`ownerId`/`ownerLabel`/`ownerSelectable`), so this branch never
          // reaches the (possibly absent) page node — a chrome region has none.
          const itemObj = selectedBand.itemObject
          const source  = fixedSchemaSource(selectedBand.itemSchema, selectedBand.itemGroups)
          const idPrefix = `insp-${selectedBand.path.replace(/\./g, '-')}`
          const title    = selectedBand.crumbTitle
            ?? itemTitle(itemObj, selectedBand.itemLabel, selectedBand.index, ctx.locale)
          const itemNode: CanvasNode = {
            id: `${selectedBand.ownerId}-${selectedBand.path}`, type: 'band-item', props: itemObj, childIds: [],
          }
          const onBack = selectedBand.ownerSelectable
            ? () => selectNode(selectedBand.ownerId)   // reselect the owning page node
            : () => selectNode(null)                   // site-frame has no whole-node dock → deselect
          return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <BandItemHeader parentType={selectedBand.ownerLabel} title={title} onBack={onBack} />
              <Inspector node={itemNode} schemaSource={source} onChange={patchItemProp} idPrefix={idPrefix} />
            </Box>
          )
        }

        if (!selected) return null
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Chip size="small" label={selected.type} color="primary" variant="outlined"
                  sx={{ alignSelf: 'flex-start' }} />
            <Inspector node={selected} onChange={patchProp} />
          </Box>
        )
      },
    })
    // ── ELEMENT · data — RE-HOMED as a FACET projection (element.facet.data) ────────
    //  SPEC-deep-authorability-completion (Gap 3): the governed metric-bind is no longer
    //  a hand-wired section here — it is now ONE MODE of the generic DATA facet
    //  (`registerFacetSections` derives `element.facet.data` from the `data` FacetDescriptor
    //  opted into by the `data-bindable` cap). That section projects the metric-bind
    //  palette ⊕ the DataSpec pipe editor (metric-optional, pipe-over-governed), so the
    //  Data surface is BOTH governed-bind AND in-place pipeline authoring — the facet-axis
    //  peer of `element.schema`, no per-type dock branch. Nothing about RightDock changes.
    // ── ELEMENT · visibility (re-registered, no longer hardcoded) ────────────────
    //  NOTE (SPEC S3): the per-type `element.context` bridge (nodeContextEditors —
    //  the `filter-bar` → FilterBarControlsBridge type-keyed map) is DELETED. It was
    //  the ADR-038 anti-pattern (a type-keyed map reaching into an element's internals
    //  from outside the generic dock). Filter controls are now `sourcedParts` (ADR-041):
    //  enumerated by the port, selected on the canvas, and projected by `element.schema`
    //  like any other part — no per-type dock branch. The dock names NO concrete type.
    .register({
      id:        'element.visibility',
      order:     30,
      appliesTo: (ctx) => wholeNodeSelected(ctx),
      render:    (ctx) => {
        const { selected, setVisibleWhen } = ctx.controller
        if (!selected) return null
        return (
          <VisibilitySection
            value={(selected.props.view as { visibleWhen?: VisibilityExpr } | undefined)?.visibleWhen}
            onChange={setVisibleWhen}
          />
        )
      },
    })
    // ── PAGE · config ────────────────────────────────────────────────────────────
    .register({
      id:        'page.config',
      order:     10,
      appliesTo: (ctx) => ctx.scope === 'page',
      render:    () => <PageInspectorPanel />,
    })
    // ── PAGE · perspectives ──────────────────────────────────────────────────────
    .register({
      id:        'page.perspectives',
      order:     20,
      appliesTo: (ctx) => ctx.scope === 'page',
      render:    (ctx) => (
        <PerspectivesPane onPreviewChange={ctx.controller.setPreviewPerspectiveId} />
      ),
    })
    // ── PAGE · filters (the pipeline card — §3.1 summary-card grammar) ────────────
    .register({
      id:        'page.filters',
      order:     30,
      appliesTo: (ctx) => ctx.scope === 'page',
      render:    (ctx) => <FiltersDrawer locale={ctx.locale} />,
    })
}

// ── registerFacetSections — the generic FACET-axis projection (ADR-041 sibling) ──
//
//  Derives ONE dock section per registered facet — the facet-axis peer of the Part
//  port's `element.schema`. Each derived section is GENERIC:
//    • APPLICABILITY = the facet's `appliesWhen` over the selected element's DECLARED
//      META (its `caps`/fields), resolved via `nodeRegistry.getMeta` — NEVER a concrete
//      `node.type` read (Law 1 · FF-NO-EXTERNAL-SPECIAL-CASE stays green).
//    • BODY = the facet's `contract` (a PropSchema) projected through the SAME generic
//      Inspector + FieldControlRegistry the part axis uses; a RICH facet (STYLE →
//      `type:'style'` → StyleField) dispatches to a rich control. Writes route through
//      `patchProp` at the facet's readPath (`view.styles`), composing with undo/redo.
//  A NEW facet = one register() call in builtinFacets; THIS function and the dock are
//  unchanged (OCP) — the facet-axis peer of "a new part = one PartField". Exported so
//  the OCP fitness can register a second facet and re-derive (idempotent by section id).
export function registerFacetSections(): void {
  for (const facet of facetRegistry.list()) {
    dockSectionRegistry.register({
      id:        `element.facet.${facet.id}`,
      order:     facet.order,
      appliesTo: (ctx) => {
        if (!wholeNodeSelected(ctx)) return false
        const sel = ctx.controller.selected
        if (!sel) return false
        const meta = nodeRegistry.getMeta(sel.type, sel.variant) as ObjectMeta | undefined
        return !!meta && facet.appliesWhen(meta)
      },
      render: (ctx) => {
        const { selected, patchProp } = ctx.controller
        if (!selected) return null
        const meta = nodeRegistry.getMeta(selected.type, selected.variant) as ObjectMeta | undefined
        if (!meta) return null
        // The facet's `contract` field carries the section label; the generic Inspector
        // renders it as the section heading + dispatches the field to its facet control
        // (STYLE → StyleField). No overline — the field label is the single heading (DRY).
        const schema = facet.contract(meta)
        return (
          <Inspector
            node={selected}
            schemaSource={fixedSchemaSource(schema, [])}
            onChange={patchProp}
            idPrefix={`insp-facet-${facet.id}`}
          />
        )
      },
    })
  }
}
