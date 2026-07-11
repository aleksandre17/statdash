import type { PanelSliceMeta } from '@statdash/react/engine'

// ── kpi-card META — the PROMOTED leaf data panel (ADR-023 · R2 expand) ────────
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
//  SHADOW STATUS (R2-expand): registered as a runtime node type behind the
//  `isPromotionEnabled('kpi-card')` flag, built ALONGSIDE the legacy
//  KpiStripNode.items[] path (Law 7 · Strangler expand). It is intentionally NOT
//  yet added to the authoring palette roster (AUTHORING_METAS), and its authoring
//  `schema`/`groups` (KpiCardNode.KpiCardSchema — defined + compile-time-verified
//  1:1 with the card's editable keys, ready to wire) are deliberately NOT attached
//  to this runtime META during shadow: the Inspector/palette AUTHORING surface is
//  an R2-CONTRACT concern (exposed once FF-PROMOTION-LOSSLESS authorizes retiring
//  the legacy path). Nothing is removed here; the card RENDERS via the flag only.
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
  version:         1,
}
