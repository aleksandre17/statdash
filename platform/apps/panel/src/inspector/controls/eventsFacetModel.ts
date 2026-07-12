// ── eventsFacetModel — the EVENTS facet's declarative authoring vocabulary + reducers ─
//
//  The pure model behind EventsField (deep-authorability slice 4). It authors an
//  element's `on: NodeEventHandler[]` — the declarative interaction grammar AR-42 built
//  (`filter`/`highlight`/`drill`) — as DATA (Law 2: no functions in config), the SAME
//  spec the runtime `useNodeInteractions`/`applySelection` spine interprets. Authoring is
//  the WRITE side of the loop the render side already consumes (build → declare → runs).
//
//  ── The union IS the SSOT (OCP · FF-ACTION-ARM-CONSUMED authoring peer) ──────────────
//  The three vocabulary tables below are typed as Records OVER the engine unions
//  (`NodeEventTrigger`, `NodeAction['type']`), so tsc FORCES an authoring entry for every
//  declared trigger/arm. A NEW trigger or a NEW `NodeAction` arm added to the grammar
//  (`packages/react/engine/node-events.ts`) is a COMPILE ERROR here until it is offered —
//  the authoring-side mirror of the render-side `FF-ACTION-ARM-CONSUMED` gate. A new arm
//  is thus "offered for free" the moment its label + param-schema entry is added; the
//  EventsField control and the facet descriptor never change (the OCP path).
//
//  ── Genericity in the DISPATCH, not auto-generation ─────────────────────────────────
//  Each arm's params are a `PropSchema` fragment — projected through the SAME generic
//  Inspector + FieldControlRegistry every other field uses (a `drill`'s `dimension` is an
//  enum-ref over the GOVERNED dimension catalog — pick a noun, never type a privileged-dim
//  literal, Law 1/2). The rich EVENTS facet resolves to a rich control (the trigger/action
//  list editor), exactly as STYLE → StyleField and DATA → DataFacetField.
//
import type {
  NodeEventHandler, NodeEventTrigger, NodeAction,
  PropSchema, PropFieldOption, LocaleString,
} from '@statdash/react/engine'

// ── TRIGGER vocabulary — a Record over NodeEventTrigger (tsc-exhaustive) ─────────────
//  The declared gestures a shell emits and the `on[]` spine folds. A new trigger in the
//  union forces a label here (authoring arm-consumed). `interval:brush` is offered though
//  its brush EMITTER is still pending (KNOWN-PENDING, tracked by FF-ACTION-ARM-CONSUMED):
//  the grammar is the SSOT; the authored handler is a valid spec that fires once wired.
export const TRIGGER_LABELS: Record<NodeEventTrigger, LocaleString> = {
  'point:click':      { ka: 'წერტილზე დაჭერა', en: 'Point click' },
  'row:click':        { ka: 'მწკრივზე დაჭერა',  en: 'Row click' },
  'row:hover':        { ka: 'მწკრივზე გადატანა', en: 'Row hover' },
  'selection:change': { ka: 'მონიშვნის ცვლილება', en: 'Selection change' },
  'interval:brush':   { ka: 'დიაპაზონის მონიშვნა', en: 'Range brush' },
}

// ── ACTION-ARM labels — a Record over NodeAction['type'] (tsc-exhaustive) ────────────
export const ACTION_ARM_LABELS: Record<NodeAction['type'], LocaleString> = {
  filter:    { ka: 'ფილტრი',   en: 'Filter' },
  highlight: { ka: 'მონიშვნა', en: 'Highlight' },
  drill:     { ka: 'ჩაღრმავება', en: 'Drill' },
}

// ── Selection-mode options — how a value folds into its param (applySelection) ───────
const MODE_OPTIONS: PropFieldOption[] = [
  { value: 'replace', label: { ka: 'ჩანაცვლება (single)', en: 'Replace (single-select)' } },
  { value: 'toggle',  label: { ka: 'დაგროვება (multi)',   en: 'Toggle (multi-select)' } },
  { value: 'clear',   label: { ka: 'გასუფთავება',         en: 'Clear' } },
]

// ── ACTION-ARM param schemas — a Record over NodeAction['type'] (tsc-exhaustive) ─────
//  Each arm's params projected through the generic Inspector. The `key`/`dimension`
//  PICKERS are enum-refs over GOVERNED catalogs (filter params / dimension defs) — the
//  author picks a governed noun, never types a raw privileged literal (Law 1/2). A new
//  arm forces a schema entry here → its editor "falls out" through the same projection.
export const ACTION_ARM_SCHEMAS: Record<NodeAction['type'], PropSchema> = {
  // filter — write a query filter param from a clicked row field (cross-filter selection).
  filter: [
    { field: 'key',       type: 'enum-ref', source: 'filterParams',
      label: { ka: 'ფილტრის პარამეტრი', en: 'Filter param' } },
    { field: 'fromField', type: 'string',
      label: { ka: 'მწკრივის ველი (არჩევითი)', en: 'Row field (optional)' } },
    { field: 'mode',      type: 'string', options: MODE_OPTIONS,
      label: { ka: 'რეჟიმი', en: 'Mode' } },
  ],
  // highlight — write a TRANSIENT highlight param (no requery); a free author-named key
  // (highlight params are not authored filter controls, so a plain string, not a picker).
  highlight: [
    { field: 'key',       type: 'string',
      label: { ka: 'მონიშვნის პარამეტრი', en: 'Highlight param' } },
    { field: 'fromField', type: 'string',
      label: { ka: 'მწკრივის ველი (არჩევითი)', en: 'Row field (optional)' } },
    { field: 'mode',      type: 'string', options: MODE_OPTIONS,
      label: { ka: 'რეჟიმი', en: 'Mode' } },
  ],
  // drill — descend a GOVERNED dimension hierarchy to a target level. `dimension` is a
  // governed DimensionDef ref (enum-ref, Law 1), `toLevel` the target hierarchy level.
  drill: [
    { field: 'dimension', type: 'enum-ref', source: 'dimensions',
      label: { ka: 'განზომილება', en: 'Dimension' } },
    { field: 'toLevel',   type: 'number', default: 1,
      label: { ka: 'სამიზნე დონე', en: 'Target level' }, validation: { min: 0 } },
  ],
}

// ── Runtime SSOTs derived from the exhaustive tables (the offered vocabularies) ──────
export const NODE_EVENT_TRIGGERS = Object.keys(TRIGGER_LABELS) as NodeEventTrigger[]
export const NODE_ACTION_TYPES   = Object.keys(ACTION_ARM_LABELS) as NodeAction['type'][]

// ── ACTION_DEFAULTS — minimal valid new action per arm (tsc-exhaustive factory) ──────
//  A Record over NodeAction['type'] → a new arm forces a default constructor. Each writes
//  the arm's required discriminant + a blank required field the author then fills.
const ACTION_DEFAULTS: Record<NodeAction['type'], () => NodeAction> = {
  filter:    () => ({ type: 'filter',    key: '' }),
  highlight: () => ({ type: 'highlight', key: '' }),
  drill:     () => ({ type: 'drill',     dimension: '', toLevel: 1 }),
}

/** Construct a fresh, minimal action of the given arm type. */
export function newAction(type: NodeAction['type']): NodeAction {
  return ACTION_DEFAULTS[type]()
}

// ── Pure, immutable reducers over the handler list ───────────────────────────────────
//  Every write returns a NEW `NodeEventHandler[]` (the Inspector owns the store write,
//  so undo/redo composes). Never mutates. Empty/undefined values are pruned so the
//  authored spec stays clean (a cleared picker drops the key rather than writing '').

type Handlers = NodeEventHandler[]

const list = (l: Handlers | undefined): Handlers => l ?? []

export function addHandler(l: Handlers | undefined, event: NodeEventTrigger): Handlers {
  return [...list(l), { event, actions: [] }]
}

export function removeHandler(l: Handlers | undefined, hIndex: number): Handlers {
  return list(l).filter((_, i) => i !== hIndex)
}

export function setHandlerTrigger(
  l: Handlers | undefined, hIndex: number, event: NodeEventTrigger,
): Handlers {
  return list(l).map((h, i) => (i === hIndex ? { ...h, event } : h))
}

function mapHandlerActions(
  l: Handlers | undefined, hIndex: number, fn: (actions: NodeAction[]) => NodeAction[],
): Handlers {
  return list(l).map((h, i) => (i === hIndex ? { ...h, actions: fn(h.actions) } : h))
}

export function addAction(
  l: Handlers | undefined, hIndex: number, type: NodeAction['type'],
): Handlers {
  return mapHandlerActions(l, hIndex, (actions) => [...actions, newAction(type)])
}

export function removeAction(l: Handlers | undefined, hIndex: number, aIndex: number): Handlers {
  return mapHandlerActions(l, hIndex, (actions) => actions.filter((_, j) => j !== aIndex))
}

export function setActionType(
  l: Handlers | undefined, hIndex: number, aIndex: number, type: NodeAction['type'],
): Handlers {
  return mapHandlerActions(l, hIndex, (actions) =>
    actions.map((a, j) => (j === aIndex ? newAction(type) : a)))
}

export function setActionParam(
  l: Handlers | undefined, hIndex: number, aIndex: number, field: string, value: unknown,
): Handlers {
  return mapHandlerActions(l, hIndex, (actions) =>
    actions.map((a, j) => {
      if (j !== aIndex) return a
      const next = { ...(a as unknown as Record<string, unknown>) }
      if (value === undefined || value === '' || value === null) delete next[field]
      else next[field] = value
      return next as unknown as NodeAction
    }))
}
