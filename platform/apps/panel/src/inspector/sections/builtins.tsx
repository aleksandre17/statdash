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
import { nodeRegistry, facetRegistry, SITE_FRAME_ID } from '@statdash/react/engine'
import type { ObjectMeta } from '@statdash/react/engine'
import { Inspector } from '../Inspector'
import { PageInspectorPanel } from '../../features/page-config'
import { PerspectivesPane } from '../../features/perspectives'
import { FiltersDrawer } from '../../features/filters'
import { ChromeCompositionPanel } from '../../features/chrome'
import { fixedSchemaSource, itemTitle } from '../controls/nestedItemControl.helpers'
import { registerBuiltinFacets } from '../facets/builtinFacets'
import { planesForRole, isPlaneVisible, filterSchemaByPlanes } from '../plane'
import { bucketByConcern, facetAppliesToElement } from '../concern'
import { ConcernGroups } from '../ConcernGroups'
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
          const idPrefix = `insp-${selectedBand.path.replace(/\./g, '-')}`
          const title    = selectedBand.crumbTitle
            ?? itemTitle(itemObj, selectedBand.itemLabel, selectedBand.index, ctx.locale)
          const itemNode: CanvasNode = {
            id: `${selectedBand.ownerId}-${selectedBand.path}`, type: 'band-item', props: itemObj, childIds: [],
          }
          const onBack = selectedBand.ownerSelectable
            ? () => selectNode(selectedBand.ownerId)   // reselect the owning page node
            : () => selectNode(null)                   // site-frame has no whole-node dock → deselect
          // Concern-group the DRILLED part (root Law 11) — the SAME spine the whole node
          // uses, so selecting a KPI card / column / chrome region reads as calm + grouped
          // as the whole-node dock, never a flat re-mush. Plane-filter FIRST so an author
          // never meets an empty plumbing-only concern box; the item declares its own part
          // itemGroups no longer (concern IS the grouping now).
          const visible = filterSchemaByPlanes(selectedBand.itemSchema, planesForRole(ctx.role))
          const buckets = bucketByConcern(visible, [])
          return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <BandItemHeader parentType={selectedBand.ownerLabel} title={title} onBack={onBack} />
              <ConcernGroups buckets={buckets} locale={ctx.locale} idBase={idPrefix} renderBucket={(b) => (
                <Inspector
                  node={itemNode}
                  schemaSource={fixedSchemaSource(b.fields, [])}
                  onChange={patchItemProp}
                  idPrefix={idPrefix}
                />
              )} />
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
    // ── ELEMENT · visibility — RE-HOMED as a FACET projection (element.facet.visibility) ─
    //  SPEC-deep-authorability-completion (Gap 2, interaction half): the `view.visibleWhen`
    //  show-when builder is no longer a hand-wired section here — it is now the generic
    //  VISIBILITY facet (`registerFacetSections` derives `element.facet.visibility` from the
    //  `visibility` FacetDescriptor, which applies to any renderable element). That section
    //  projects the SAME recursive VisibilitySection builder through the facet axis, the peer
    //  of how the DATA facet folded the old `element.data` metric-bind. Nothing about RightDock
    //  changes; the retired `setVisibleWhen` write lane is left orphaned (a follow-up cleanup).
    //  NOTE (SPEC S3): the per-type `element.context` bridge (nodeContextEditors — the
    //  `filter-bar` → FilterBarControlsBridge type-keyed map) is DELETED. It was the ADR-038
    //  anti-pattern (a type-keyed map reaching into an element's internals from outside the
    //  generic dock). Filter controls are now `sourcedParts` (ADR-041): enumerated by the port,
    //  selected on the canvas, and projected by `element.schema` like any other part.
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
    // ── ELEMENT · site-frame chrome COMPOSITION (Gap 1 · D-CH1) ────────────────────
    //  The synthetic site-frame is a reachable WHOLE element: selecting it (a chrome
    //  region's "Back") opens this composition inspector — the SET of chrome regions
    //  (enable/disable via variant, region, order), the home the per-region facet lacked.
    //  Fires ONLY on the site-frame whole selection (no page node, no drilled part), so it
    //  never collides with a page-node inspector. Reuses the SAME store actions (no fork).
    .register({
      id:        'element.chrome-composition',
      order:     10,
      appliesTo: (ctx) =>
        ctx.scope === 'element'
        && ctx.controller.selectedId === SITE_FRAME_ID
        && !ctx.controller.selected
        && !ctx.controller.selectedBand,
      render:    (ctx) => <ChromeCompositionPanel locale={ctx.locale} controller={ctx.controller} />,
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
        // PLANE (root Law 11 · ADR-043): a non-author facet (e.g. VISIBILITY, `steward`)
        // never renders in the author dock — the facet-level peer of the Inspector's
        // field-level plane filter. `ctx.role` absent ⇒ author lens (safe default).
        if (!isPlaneVisible(facet.plane, planesForRole(ctx.role))) return false
        // The ONE shared applicability predicate (card 0112 · S2/R2 · ADR-041 residence):
        // TYPE-cap (meta.appliesWhen) ∨ INSTANCE-readPath (the selected element CARRIES a
        // value at the facet's readPath) — so a data-OWNING section still exposes its Data
        // facet + door onto ITS spec. Sharing it with the concern dock (applicableFacets)
        // is what kills the flat-vs-concern divergence that hid the facet LIVE. A drilled
        // band-item part has no whole-node `selected` → props undefined → TYPE branch only.
        const meta = selectedElementMeta(ctx)
        return facetAppliesToElement(facet, meta, ctx.controller.selected?.props)
      },
      render: (ctx) => {
        const meta = selectedElementMeta(ctx)
        if (!meta) return null
        // The facet's `contract` field carries the section label; the generic Inspector
        // renders it as the section heading + dispatches the field to its facet control
        // (STYLE → StyleField, chrome variant/region → SelectControl). No overline — the
        // field label is the single heading (DRY). The projection is bounded to the
        // SELECTED element — a whole page node (write → node props) OR a bounded chrome
        // region PART (write → the chrome structural lane), the SAME generic Inspector.
        const schema = facet.contract(meta)
        const band   = ctx.controller.selectedBand
        if (band?.partMeta) {
          const facetNode: CanvasNode = {
            id: `${band.ownerId}-facet-${facet.id}`, type: 'facet', props: band.slotConfig ?? {}, childIds: [],
          }
          return (
            <Inspector
              node={facetNode}
              schemaSource={fixedSchemaSource(schema, [])}
              onChange={ctx.controller.patchChromeStructural}
              idPrefix={`insp-facet-${facet.id}`}
            />
          )
        }
        const { selected, patchProp } = ctx.controller
        if (!selected) return null
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

// ── selectedElementMeta — the DECLARED meta of the selected bounded element ───────
//
//  The facet axis projects over the selected ELEMENT's declaration (ADR-038). That
//  element is EITHER a whole page node (its `nodeRegistry` meta) OR a bounded PART that
//  carries its own element meta — a chrome region's `ChromeSliceMeta` (surfaced on
//  `selectedBand.partMeta`). A positional value/filter part carries NO element meta (its
//  contract is an `itemSchema`, projected by `element.schema`) → undefined here, so the
//  facet sections stay hidden during a value-band drill, exactly as before this extension.
//  The derivation names NO concrete type — it reads whichever declaration the selection
//  exposes (Law 1 · FF-NO-EXTERNAL-SPECIAL-CASE stays green).
function selectedElementMeta(ctx: DockRenderCtx): ObjectMeta | undefined {
  const { selected, selectedBand } = ctx.controller
  if (selectedBand) return selectedBand.partMeta
  if (selected) return nodeRegistry.getMeta(selected.type, selected.variant) as ObjectMeta | undefined
  return undefined
}
