import type { PanelSliceMeta } from '@statdash/react/engine'
import { KpiCardSchema, KpiCardGroups } from './KpiCardNode'

// ── kpi-card META — the PROMOTED first-class leaf data panel (ADR-023 · R2) ────
//
//  A leaf panel (canHaveChildren:false) rendering ONE KPI metric. Registered like
//  any other node type (Law 1 / OCP — the engine special-cases nothing); it flows
//  through renderNode the moment this slice is registered.
//
//  I18N: the card borrows the `kpi-strip` namespace (trend-up/down/flat +
//  methodology) — it is part of the kpi-strip plugin family and shares its
//  vocabulary, so no duplicate catalog is shipped (DRY) and the promoted card
//  resolves BYTE-IDENTICAL trend/aria labels to the legacy strip render.
//
//  ── AUTHORING SURFACE (R2-EXPAND · ACTIVATED) ──────────────────────────────
//  The card carries its OWN PropSchema + PropertyGroups (KpiCardNode.KpiCardSchema,
//  compile-time-verified 1:1 with the card's editable keys). Attaching them here
//  makes `nodeRegistry.getSchema('kpi-card')` return the card's form, so the
//  Constructor Inspector renders the card as a FIRST-CLASS editable object — its
//  {label, value, unit, color, trend, …} authored directly, its visibility on the
//  node facet `view.visibleWhen` (never a value-band `when`). This is the owner's
//  "everything is its own type" made real: the card is selectable + editable as an
//  object, not only reachable as a nested item inside the strip's itemSchema.
//
//  PALETTE ROSTER (still deferred): the card is intentionally NOT in AUTHORING_METAS
//  (the draggable palette roster). A standalone card dragged onto a bare page is a
//  distinct capability (a lone KPI outside a strip grid) that lands with the
//  items[]→children CONTRACT migration; the object model's activation here is the
//  render residence + selection/inspection of the strip's cards, not palette drag.
//
export const META: PanelSliceMeta = {
  sliceType:       'panel',
  type:            'kpi-card',
  variant:         'default',
  label:           { ka: 'KPI ბარათი', en: 'KPI Card' },
  icon:            'trending-up',
  category:        'data',
  canHaveChildren: false,
  caps:            ['kpi', 'filterable'],
  schema:          KpiCardSchema,
  groups:          KpiCardGroups,
  version:         1,
}
