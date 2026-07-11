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
import { ChromeInspectorPanel } from '../ChromeInspectorPanel'
import { VisibilitySection } from '../../features/visibility'
import { PageInspectorPanel } from '../../features/page-config'
import { PerspectivesPane } from '../../features/perspectives'
import { FiltersDrawer } from '../../features/filters'
import { nodeContextEditors } from '../../studio/nodeContextEditors'
import { getAtPath } from '../showWhen'
import { fixedSchemaSource, itemTitle } from '../controls/nestedItemControl.helpers'
import type { CanvasNode } from '../../types/constructor'
import { dockSectionRegistry, type DockRenderCtx } from './dockSection'

/** A node (not chrome) is selected in the element context — the shared guard. */
const nodeSelected = (ctx: DockRenderCtx): boolean =>
  ctx.scope === 'element' && !!ctx.controller.selected && !ctx.controller.chromeSel

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
      appliesTo: (ctx) => nodeSelected(ctx),
      render:    (ctx) => {
        const { selected, selectedBand, patchProp, patchItemProp, selectNode } = ctx.controller
        if (!selected) return null

        if (selectedBand) {
          const itemObj = (getAtPath(selected.props, selectedBand.path) ?? {}) as Record<string, unknown>
          const source  = fixedSchemaSource(selectedBand.itemSchema, selectedBand.itemGroups)
          const idPrefix = `insp-${selectedBand.path.replace(/\./g, '-')}`
          const title    = itemTitle(itemObj, selectedBand.itemLabel, selectedBand.index, ctx.locale)
          const itemNode: CanvasNode = {
            id: `${selected.id}-${selectedBand.path}`, type: 'band-item', props: itemObj, childIds: [],
          }
          return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <BandItemHeader parentType={selected.type} title={title} onBack={() => selectNode(selected.id)} />
              <Inspector node={itemNode} schemaSource={source} onChange={patchItemProp} idPrefix={idPrefix} />
            </Box>
          )
        }

        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Chip size="small" label={selected.type} color="primary" variant="outlined"
                  sx={{ alignSelf: 'flex-start' }} />
            <Inspector node={selected} onChange={patchProp} />
          </Box>
        )
      },
    })
    // ── ELEMENT · node-context bridge (e.g. filter-bar → its controls, D7.3) ──────
    .register({
      id:        'element.context',
      order:     20,
      appliesTo: (ctx) =>
        wholeNodeSelected(ctx) && !!nodeContextEditors[ctx.controller.selected!.type],
      render:    (ctx) => {
        const { selected } = ctx.controller
        const ContextEditor = selected ? nodeContextEditors[selected.type] : undefined
        return ContextEditor && selected
          ? <ContextEditor node={selected} locale={ctx.locale} />
          : null
      },
    })
    // ── ELEMENT · visibility (re-registered, no longer hardcoded) ────────────────
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
    // ── ELEMENT · chrome (mutually exclusive with the node sections) ─────────────
    .register({
      id:        'element.chrome',
      order:     10,
      appliesTo: (ctx) => ctx.scope === 'element' && !!ctx.controller.chromeSel,
      render:    () => <ChromeInspectorPanel />,
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
