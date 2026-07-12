// ── builtinFacets — the app's concrete FACET registrations (labels live here) ────
//
//  packages/react owns the generic FACET mechanism (FacetDescriptor + facetRegistry),
//  but is locale-agnostic (Law 4) — so the concrete built-in facets, WITH their
//  bilingual labels, are declared HERE (app tier), exactly as the dock sections and
//  field controls are. Importing this module registers them (idempotent side-effect).
//
//  Slice 1 registers the ONE STYLE facet. A later slice adds DATA/EVENTS/CHROME as
//  MORE register() calls — the dock-section derivation (builtins) is unchanged (OCP).
//
import { facetRegistry, CAPS } from '@statdash/react/engine'
import type { LocaleString } from '@statdash/react/engine'

const STYLE_LABEL: LocaleString = { ka: 'სტილი', en: 'Style' }
const DATA_LABEL:  LocaleString = { ka: 'მონაცემები', en: 'Data' }

let registered = false

/** Idempotently register the platform's built-in facets. Safe from boot + tests. */
export function registerBuiltinFacets(): void {
  if (registered) return
  registered = true

  // ── STYLE (Gap 4) — whole-element token-constrained `view.styles` authoring ──────
  //  Opt-in by the declared `styleable` cap (a signal, not a type read — Law 1). The
  //  contract is a single `type:'style'` field the dock dispatches to StyleField via
  //  FieldControlRegistry; `resolveStyle`/`applyNodeStyles` renders `view.styles` live.
  facetRegistry.register({
    id:          'style',
    order:       40,
    readPath:    'view.styles',
    label:       STYLE_LABEL,
    appliesWhen: (meta) => !!meta.caps?.includes(CAPS.STYLEABLE),
    contract:    () => [{ field: 'view.styles', type: 'style', label: STYLE_LABEL }],
  })

  // ── DATA (Gap 3) — per-element `data: DataSpec` pipeline authoring, metric-OPTIONAL ─
  //  Opt-in by the declared `data-bindable` cap (a signal, not a type read — Law 1), so
  //  ANY data-bindable element — chart/table/kpi/… — projects an `element.facet.data`
  //  dock section, NOT a concrete type (FF-NO-EXTERNAL-SPECIAL-CASE stays green). The
  //  contract is a single `type:'data-pipeline'` field the dock dispatches to
  //  DataFacetField via FieldControlRegistry: the governed metric-bind (element.data's
  //  re-homed ONE mode) ⊕ the DataSpec pipe editor (transform/derive/calc over a
  //  governed source — no metric required). `readPath:'data'` is where the facet lives
  //  on the config (the runner interprets `node.data`); the D-DA1 governance LENS
  //  (author = pipe-over-governed; steward = raw-source) lives inside the control +
  //  FF-AUTHOR-NO-QUERY. Order 20 — between content (10) and visibility (30), the slot
  //  the retired hand-wired `element.data` section held (now a facet projection).
  facetRegistry.register({
    id:          'data',
    order:       20,
    readPath:    'data',
    label:       DATA_LABEL,
    appliesWhen: (meta) => !!meta.caps?.includes(CAPS.DATA_BINDABLE),
    contract:    () => [{ field: 'data', type: 'data-pipeline', label: DATA_LABEL }],
  })
}
