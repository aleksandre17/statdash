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
import { Inspector } from '../Inspector'
import { MetricPalette } from '../../discovery/MetricPalette'
import { VisibilitySection } from '../../features/visibility'
import { PageInspectorPanel } from '../../features/page-config'
import { PerspectivesPane } from '../../features/perspectives'
import { FiltersDrawer } from '../../features/filters'
import { fixedSchemaSource, itemTitle } from '../controls/nestedItemControl.helpers'
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
    // ── ELEMENT · data (the governed metric bind — re-homed from the Data surface) ─
    //  SPEC-studio-ia-canonical S5: metric binding is no longer a peer rail surface —
    //  it is a CONTEXTUAL section of the inspector, shown ONLY when the selected element
    //  DECLARES a metric field (`selectedBindable`, derived from its PropSchema). A
    //  data-bound element (chart/kpi) selected → its Data section offers the governed
    //  Metric Palette (bind-by-noun); a non-bindable element shows no Data section (the
    //  Figma law — only the selection's own contract). Zero per-type code: the section
    //  applies by a DECLARED facet, and binds through the SAME onBind/bindMetric write
    //  the Data surface used (Strangler re-home — the palette is MOUNTED, not rewritten).
    .register({
      id:        'element.data',
      order:     20,
      appliesTo: (ctx) => wholeNodeSelected(ctx) && ctx.controller.selectedBindable,
      render:    (ctx) => {
        const { selectedId, bindMetric } = ctx.controller
        const en = ctx.locale === 'en'
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="overline" color="text.secondary">
              {en ? 'Data' : 'მონაცემები'}
            </Typography>
            <MetricPalette
              locale={ctx.locale}
              canBind
              bindHint={en ? 'Pick a metric to bind this element' : 'აირჩიეთ მეტრიკა ამ ელემენტის მისაბმელად'}
              onBind={(metricId) => { if (selectedId) bindMetric(selectedId, metricId) }}
            />
          </Box>
        )
      },
    })
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
