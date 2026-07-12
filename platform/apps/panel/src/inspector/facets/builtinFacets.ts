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
import type { LocaleString, ObjectMeta } from '@statdash/react/engine'
import { chromeStructuralContract, CHROME_STRUCTURAL_LABELS } from './chromeFacetModel'

const STYLE_LABEL:  LocaleString = { ka: 'სტილი', en: 'Style' }
const DATA_LABEL:   LocaleString = { ka: 'მონაცემები', en: 'Data' }
const EVENTS_LABEL: LocaleString = { ka: 'ინტერაქციები', en: 'Interactions' }

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

  // ── EVENTS (Gap 2) — per-element `on: NodeEventHandler[]` interaction authoring ──
  //  Opt-in by the declared `interactive` cap (a signal, not a type read — Law 1), so
  //  ANY interaction-capable element — chart/table/kpi/map — projects an
  //  `element.facet.events` dock section, NOT a concrete type (FF-NO-EXTERNAL-SPECIAL-
  //  CASE stays green). The contract is a single `type:'events'` field the dock dispatches
  //  to EventsField via FieldControlRegistry: a trigger/action list editor over the SAME
  //  declared NodeAction grammar (filter/highlight/drill) AR-42 built. `readPath:'on'` is
  //  where the facet lives on the config; the runner interprets `node.on` through the
  //  existing `useNodeInteractions`/`applySelection` spine (build → declare → runs — the
  //  authored value is a valid interpretable spec, zero new runtime). Order 50 — after
  //  style (40); interactions are the last, most-advanced facet in the element dock.
  facetRegistry.register({
    id:          'events',
    order:       50,
    readPath:    'on',
    label:       EVENTS_LABEL,
    appliesWhen: (meta) => !!meta.caps?.includes(CAPS.INTERACTIVE),
    contract:    () => [{ field: 'on', type: 'events', label: EVENTS_LABEL }],
  })

  // ── CHROME (Gap 1) — the site-frame's chrome regions as a FULL structural facet ──
  //  Post-S6 a chrome region is a `sourced` Part of the synthetic site-frame; selecting
  //  it already projects the variant's own `config` schema through `element.schema`. This
  //  facet completes the contract: it projects the STRUCTURAL facets `variant` · `region`
  //  · `order` (the `ChromeSlotConfig` top level) that lived outside any authorable
  //  surface. Opt-in by the DECLARED chrome field `slot` (only a `ChromeSliceMeta` carries
  //  it) — a declared-FIELD predicate, NEVER a concrete-type literal (Law 1 · FF-NO-
  //  EXTERNAL-SPECIAL-CASE stays green), the peer of style's `styleable` cap. `contract`
  //  reads `meta.slot` to resolve the slot's registered variants (`chromeStructuralContract`),
  //  so a new chrome variant is offered by REGISTERING it (OCP — the picker is never edited).
  //  `readPath:''` — the fields live at the ChromeSlotConfig top level; the structural write
  //  lane (`updateChromeSlotField`) commits them, distinct from `config` (`updateChromeConfig`).
  facetRegistry.register({
    id:          'chrome',
    order:       15,
    readPath:    '',
    label:       CHROME_STRUCTURAL_LABELS.facet,
    appliesWhen: (meta) => typeof (meta as { slot?: unknown }).slot === 'string',
    contract:    (meta: ObjectMeta) => chromeStructuralContract((meta as { slot?: string }).slot ?? ''),
  })
}
