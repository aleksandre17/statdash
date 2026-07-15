// ── NestedItemControl — the generic recursive nested-item editor (D7.1b) ─────
//
//  The controls that make the D7.0 `PropField.itemSchema` seam VISIBLE. An
//  array/object field that carries an `itemSchema` (ADR-022) is no longer an
//  opaque raw-JSON blob: it becomes a STRUCTURED editor an author drives
//  item-by-item — reach a KPI-strip item, a hero card, a chart axis…
//
//  ── DRILL-IN, one active level at a time (the contextual-relevance canon) ────
//  D7.1 rendered EVERY item's full form expanded at once (a KPI array dumped
//  label KA/EN + metric + type + a `value` sub-object + unit + color + … for
//  every item, stacked). That violates the same "only the ACTIVE one's
//  everything shows" canon we hold at the left/right docks and the canvas
//  selection. D7.1b reworks it into PROGRESSIVE DISCLOSURE, benchmarked against  ხო
//      rendered expanded — at any instant AT MOST ONE item's field-editor exists.
//    • An OBJECT (or a drilled item) shows its scalar fields inline; its OWN
//      nested array/object sub-fields render as DRILL ROWS, not expanded — so
//      drilling `KPI › item › value › …` pushes a crumb per level, arbitrary
//      depth, each crumb navigating back up. "You go maximally all the way in,
//      and only the active one's everything shows."
//
//  ── ONE DrillEditor per root field, ONE unified breadcrumb ───────────────────
//  The ROOT array/object field mounts a single `DrillEditor` that owns the whole
//  drill PATH (component-local UI state, like the canvas selection — never
//  config). Every deeper level lives INSIDE that same editor: a nested field is
//  rendered (by the generic Inspector) as a `NestedFieldRow` drill affordance
//  that, via `DrillContext`, pushes another crumb onto the SAME path. So the
//  breadcrumb is unified across arbitrary array/object nesting, and only the
//  deepest level is ever rendered — the drill is DATA-navigated, not
//  render-recursed, which also removes the old cyclic-schema infinite-render
//  risk by construction. A depth cap (`MAX_NESTING`) is the backstop: a nested
//  field at the cap degrades to the raw-JSON control instead of drilling on.
//
//  Object-level fields are authored by the ONE generic <Inspector> over a fixed
//  `itemSchema` source — no bespoke per-item form (OCP / the one-Inspector
//  mandate), inheriting its grouping (itemGroups), validation, locale handling,
//  and the raw-JSON fallback for OPAQUE_BY_DESIGN fields (no itemSchema).
//
//  WRITES are immutable nested writes through `setAtPath` on the absolute
//  dot-path from the root value (D7.0 grammar): only the touched branch is
//  cloned, every sibling stays referentially stable.
//
//  App-agnostic: GENERIC over any PropSchema. No node/plugin/Geostat field names,
//  no domain literals — the editor knows only `PropSchema` + the dot-path grammar.
//
import './NestedItemControl.css'
import {
  createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState,
  type ReactNode,
} from 'react'
import type { PropSchema, PropertyGroup, PropField } from '@statdash/react/engine'
import type { FieldControlProps } from '../fieldControl.types'
import type { CanvasNode, Locale } from '../../types/constructor'
import { Inspector } from '../Inspector'
import { ConcernGroups } from '../ConcernGroups'
import { bucketByConcern } from '../concern'
import { useVisiblePlanes, filterSchemaByPlanes } from '../plane'
import { JsonControl } from './primitives'
// Pure helpers (dot-path grammar + label/summary/seed), extracted for one-body hygiene.
import {
  readAt, writeAt, joinPath, pathToId,
  fixedSchemaSource, makeDefaultItem, fieldLabel, itemTitle, summarizeArray, summarizeObject,
} from './nestedItemControl.helpers'
import { useBreadcrumbSlot } from '../breadcrumbSlot'
// The glance-weight RENAME micro-edit, routed to the SL-3 <EditPopover> (§3.2
// nested-item · glance → POPOVER). Extracted to its own concern (one-body hygiene).
import { useRowRename } from './useRowRename'
// SL-4 — the overflow-escalation seam. A workspace-weight drill target escalates OUT
// of the bounded dock to a focus-view (the Placement Law verdict), instead of cramming.
import { useFocusEscalation } from '../focusEscalation'
import { shouldEscalate } from './nestedItemPlacement'

// ── Drill-depth backstop ──────────────────────────────────────────────────────
//
//  itemSchema nesting is a finite DATA structure, so real drilling always
//  terminates. This guard exists ONLY for a malformed/cyclic itemSchema (a meta
//  bug): once the drill PATH reaches MAX_NESTING levels a nested field renders
//  the raw-JSON control instead of offering to drill further — bounded, never an
//  unbounded path.
//
const MAX_NESTING = 8

// ── DrillContext — a nested array/object field becomes a drill affordance ──────
//
//  Present ONLY inside a drilled object screen. When a field control detects it,
//  the control renders a `NestedFieldRow` that pushes another crumb onto the
//  ancestor DrillEditor's single path — instead of expanding inline. Absent (the
//  default) → the control is the ROOT of a new DrillEditor.
//
interface DrillHandle {
  /** Absolute dot-path of the object screen currently rendering this field. */
  baseDotPath: string
  /** Current drill depth (= breadcrumb length); a field at/over MAX degrades. */
  depth: number
  /** Drill into a nested field of the current object screen (pushes a crumb). */
  drill: (field: PropField, title: string) => void
}
const DrillContext = createContext<DrillHandle | null>(null)

// ── Drill path model ──────────────────────────────────────────────────────────
//
//  A crumb is one level in the path. The ROOT crumb is derived from the field;
//  every deeper crumb is a `Step` the author drilled into (an item index, or a
//  nested field name). `dotPath` is cumulative & absolute from the root value.
//
type LevelKind = 'array' | 'object'

interface Step {
  seg:             string          // path segment appended (item index | nested field)
  label:           string          // static crumb text (a nested-field drill)
  kind:            LevelKind
  schema:          PropSchema       // fields at THIS level (item fields for an array)
  groups:          PropertyGroup[]
  itemLabel?:      string           // array only: how to title its items
  isItem?:         boolean          // true → an opened array item (title derived live)
  titleItemLabel?: string           // item only: the parent array's itemLabel path
}

interface Crumb extends Step {
  dotPath: string             // absolute path from the root value ('' = root)
}

// ── ArrayOfControl / ObjectControl — the registry-facing entry points ─────────
//
//  If a DrillContext is present, this control is a NESTED field inside a drilled
//  object screen → render a drill affordance. Otherwise it is the ROOT of its
//  own DrillEditor (the top-level array/object property).
//
export function ArrayOfControl(props: FieldControlProps): ReactNode {
  const ctx = useContext(DrillContext)
  return ctx
    ? <NestedFieldRow {...props} ctx={ctx} kind="array" />
    : <DrillEditor {...props} rootKind="array" />
}

export function ObjectControl(props: FieldControlProps): ReactNode {
  const ctx = useContext(DrillContext)
  return ctx
    ? <NestedFieldRow {...props} ctx={ctx} kind="object" />
    : <DrillEditor {...props} rootKind="object" />
}

// ── NestedFieldRow — a nested array/object field, collapsed to a drill row ────

function NestedFieldRow(
  props: FieldControlProps & { ctx: DrillHandle; kind: LevelKind },
): ReactNode {
  const { field, id, value, locale, ctx, kind } = props

  // Depth backstop for a malformed/cyclic itemSchema — degrade to raw JSON at the
  // cap rather than offer an unbounded drill.
  if (ctx.depth >= MAX_NESTING) return <JsonControl {...props} />

  const label   = fieldLabel(field, locale)
  const summary = kind === 'array'
    ? summarizeArray(value)
    : (summarizeObject(value, field, locale) || label)

  return (
    <button
      type="button"
      id={id}
      className="insp-nested__drill-row"
      onClick={() => ctx.drill(field, label)}
      aria-label={`Edit ${label}`}
    >
      <span className="insp-nested__drill-summary">{summary}</span>
      <span className="insp-nested__chevron" aria-hidden="true">›</span>
    </button>
  )
}

// ── DrillEditor — one root field, one unified drill path + breadcrumb ─────────

function DrillEditor(
  props: FieldControlProps & { rootKind: LevelKind; initialSteps?: Step[] },
): ReactNode {
  const { field, id, value, onChange, locales, locale, rootKind, initialSteps } = props

  const rootLabel = fieldLabel(field, locale)

  // The steps the author has drilled into, beyond the root (component-local UI
  // state — like the canvas selection, never config). An ESCALATED mount (SL-4) is
  // SEEDED with the drill path that led here (`initialSteps`), so the focus-view opens
  // exactly at the escalation point and the breadcrumb spine continues unbroken.
  const [steps, setSteps] = useState<Step[]>(initialSteps ?? [])

  // SL-4 — the overflow-escalation host (the dock's StudioShell). Null in isolation
  // (unit tests, any other mount) → the editor falls back to an in-dock drill exactly
  // as D7.1b did (fail-soft — zero regression); the shell always provides it live.
  const escalation = useFocusEscalation()

  // Crumbs = the root (derived from the field, always fresh) + the drilled steps,
  // with cumulative absolute dot-paths.
  const crumbs = useMemo<Crumb[]>(() => {
    const list: Crumb[] = [{
      dotPath:   '',
      seg:       '',
      label:     rootLabel,
      kind:      rootKind,
      schema:    field.itemSchema ?? [],
      groups:    field.itemGroups ?? [],
      itemLabel: field.itemLabel,
    }]
    let dp = ''
    for (const s of steps) {
      dp = joinPath(dp, s.seg)
      // An opened item derives its crumb title LIVE from the current value (edit
      // the item's label → the breadcrumb updates); a nested-field crumb is static.
      const label = s.isItem
        ? itemTitle(readAt(value, dp), s.titleItemLabel, Number(s.seg), locale)
        : s.label
      list.push({ ...s, dotPath: dp, label })
    }
    return list
  }, [steps, field, rootLabel, rootKind, value, locale])

  // Clamp (DERIVED, never an effect): if the root value changes underneath us
  // (undo/redo, external write) such that a drilled crumb no longer resolves, we
  // render only the still-valid prefix — never a screen over a vanished branch.
  // Pure-render derivation is the correct pattern here (no setState-in-effect).
  const activeCrumbs = useMemo<Crumb[]>(() => {
    const out: Crumb[] = []
    for (const c of crumbs) {
      if (c.dotPath !== '' && readAt(value, c.dotPath) === undefined) break
      out.push(c)
    }
    return out.length ? out : crumbs.slice(0, 1)
  }, [crumbs, value])

  // Focus moves INTO the newly-drilled level (WCAG: the drill is a context change).
  const screenRef = useRef<HTMLDivElement>(null)
  const prevDepth = useRef(activeCrumbs.length)
  useEffect(() => {
    const depth = activeCrumbs.length
    if (depth > prevDepth.current && screenRef.current) {
      screenRef.current
        .querySelector<HTMLElement>('input, select, textarea, button, [tabindex]:not([tabindex="-1"])')
        ?.focus()
    }
    prevDepth.current = depth
  }, [activeCrumbs.length])

  const deepest = activeCrumbs[activeCrumbs.length - 1]

  const emitRoot = useCallback((next: unknown) => onChange(next), [onChange])
  const goTo     = useCallback((i: number) => setSteps((prev) => prev.slice(0, i)), [])

  // ── One-header-tier promotion (SL-1) ────────────────────────────────────────
  //  When a HOST provides a breadcrumb slot (the RightDock header), a DRILLED editor
  //  promotes its breadcrumb UP into that slot — replacing the dock's context switch
  //  — instead of rendering it in-body. With no host (isolation / other mounts) the
  //  slot is null and the breadcrumb renders locally, exactly as D7.1b did.
  const slot     = useBreadcrumbSlot()
  const slotId   = useId()
  const drilled  = activeCrumbs.length > 1
  const hoisted  = drilled && slot != null
  useEffect(() => {
    if (!slot) return
    if (drilled) slot.promote(slotId, <Breadcrumb crumbs={activeCrumbs} onNavigate={goTo} />)
    else         slot.release(slotId)
  }, [slot, slotId, drilled, activeCrumbs, goTo])
  useEffect(() => () => slot?.release(slotId), [slot, slotId])

  // ── SL-4 escalation — hand a workspace subject OUT to a focus-view ────────────
  //  The escalated editor is the SAME DrillEditor rooted at THIS top-level field,
  //  pre-seeded with the full drill path (`nextSteps`) so the ONE breadcrumb spine
  //  continues; it binds to a LIVE store value the host supplies, so edits round-trip
  //  and Back is loss-free. Deterministic: the target is `resolveSurface`'s verdict.
  const escalateTo = useCallback((nextSteps: Step[], title: string) => {
    escalation?.escalate({
      source:    'node-field',
      fieldPath: field.field,
      title:     { ka: title, en: title },
      render:    (bind) => (
        <DrillEditor
          field={field}
          id={id}
          value={bind.value}
          onChange={bind.onChange}
          locales={locales}
          locale={locale}
          rootKind={rootKind}
          initialSteps={nextSteps}
        />
      ),
    })
  }, [escalation, field, id, locales, locale, rootKind])

  // Drill into a nested field of the CURRENT object screen (append a crumb) — OR, when
  // that field is a workspace-weight OBJECT (its itemSchema is rich/deep), escalate it
  // out to a focus-view. An ARRAY field stays a bounded in-dock LIST (its items escalate
  // on open, below). The verdict is the pure Placement Law — no per-type literal.
  const drill = useCallback((f: PropField, title: string) => {
    const step: Step = {
      seg:       f.field,
      label:     title,
      kind:      f.type === 'array' ? 'array' : 'object',
      schema:    f.itemSchema ?? [],
      groups:    f.itemGroups ?? [],
      itemLabel: f.itemLabel,
    }
    if (escalation && f.type !== 'array' && shouldEscalate(f.itemSchema ?? [])) {
      escalateTo([...steps, step], title)
    } else {
      setSteps((prev) => [...prev, step])
    }
  }, [escalation, escalateTo, steps])

  // Open an item of the CURRENT array screen (its fields = the array's itemSchema).
  // A WORKSPACE-weight item (rich/deep itemSchema) escalates OUT to a focus-view; a
  // form-weight one drills in the dock, unchanged (D7.1b) — FF-NO-CRAMMED-DOCK.
  const openItem = (index: number, title: string) => {
    const itemStep: Step = {
      seg:            String(index),
      label:          title,
      kind:           'object',
      schema:         deepest.schema,
      groups:         deepest.groups,
      isItem:         true,
      titleItemLabel: deepest.itemLabel,
    }
    if (escalation && shouldEscalate(deepest.schema)) {
      escalateTo([...steps, itemStep], title)
    } else {
      setSteps((prev) => [...prev, itemStep])
    }
  }

  return (
    <div className="insp-nested" role="group" aria-label={rootLabel}>
      {drilled && !hoisted && <Breadcrumb crumbs={activeCrumbs} onNavigate={goTo} />}
      <div className="insp-nested__screen" ref={screenRef}>
        {deepest.kind === 'array' ? (
          <ArrayListScreen
            arr={readAt(value, deepest.dotPath)}
            itemSchema={deepest.schema}
            itemLabel={deepest.itemLabel}
            locale={locale}
            onEmit={(nextArr) => emitRoot(writeAt(value, deepest.dotPath, nextArr))}
            onOpen={openItem}
          />
        ) : (
          <ObjectFormScreen
            rootValue={value}
            dotPath={deepest.dotPath}
            schema={deepest.schema}
            depth={activeCrumbs.length}
            idPrefix={pathToId(id, deepest.dotPath)}
            locale={locale}
            onEmitRoot={emitRoot}
            onDrill={drill}
          />
        )}
      </div>
    </div>
  )
}

// ── Breadcrumb — the drill path, each crumb a button that navigates back up ───

function Breadcrumb({
  crumbs, onNavigate,
}: { crumbs: Crumb[]; onNavigate: (index: number) => void }): ReactNode {
  return (
    <nav className="insp-nested__crumbs" aria-label="Breadcrumb">
      <ol className="insp-nested__crumb-list">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <li key={c.dotPath || 'root'} className="insp-nested__crumb">
              {last ? (
                <span className="insp-nested__crumb-current" aria-current="page">{c.label}</span>
              ) : (
                <>
                  <button
                    type="button"
                    className="insp-nested__crumb-btn"
                    onClick={() => onNavigate(i)}
                  >{c.label}</button>
                  <span className="insp-nested__crumb-sep" aria-hidden="true">›</span>
                </>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

// ── ArrayListScreen — summary rows for one array level (no fields expanded) ───

function ArrayListScreen({
  arr, itemSchema, itemLabel, locale, onEmit, onOpen,
}: {
  arr:        unknown
  itemSchema: PropSchema
  itemLabel:  string | undefined
  locale:     Locale
  onEmit:     (next: unknown[]) => void
  onOpen:     (index: number, title: string) => void
}): ReactNode {
  const items = Array.isArray(arr) ? (arr as unknown[]) : []

  // Focus target after a remove — resolved post-commit against the fresh DOM.
  const rootRef  = useRef<HTMLDivElement>(null)
  const focusReq = useRef<{ index: number } | null>(null)
  useEffect(() => {
    const req = focusReq.current
    if (!req || !rootRef.current) return
    focusReq.current = null
    const root = rootRef.current
    const target =
      root.querySelector<HTMLElement>(`[data-item-index="${req.index}"] .insp-nested__remove`) ??
      root.querySelector<HTMLElement>('.insp-nested__add')
    target?.focus()
  })

  const add = () => {
    const index = items.length
    onEmit([...items, makeDefaultItem(itemSchema)])
    onOpen(index, `Item ${index + 1}`)          // create → drill straight in
  }
  const removeItem = (i: number) => {
    focusReq.current = { index: Math.min(i, items.length - 2) } // next row, else add-btn
    onEmit(items.filter((_, idx) => idx !== i))
  }
  const move = (i: number, delta: number) => {
    const j = i + delta
    if (j < 0 || j >= items.length) return
    const next = items.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    onEmit(next)
  }

  // ── Rename — the glance-weight micro-edit, routed to the SL-3 popover ──────────
  //  Renaming ONE row (its `itemLabel` field) is a single transient property: §3.2
  //  nested-item · glance → POPOVER. Encapsulated in `useRowRename` (one concern per
  //  file): it edits the label IN PLACE, anchored to the row, without drilling into
  //  the whole item form (that would be the form-weight dock-drill).
  const rowRename = useRowRename({
    items, itemLabel, locale, onEmit,
    titleOf: (i) => itemTitle(items[i], itemLabel, i, locale),
  })

  return (
    <div ref={rootRef}>
      {items.length === 0 ? (
        <p className="insp-nested__empty">No items yet.</p>
      ) : (
        <ul className="insp-nested__list">
          {items.map((item, i) => {
            const title = itemTitle(item, itemLabel, i, locale)
            return (
              <li key={i} className="insp-nested__item" data-item-index={i}>
                <button
                  type="button"
                  className="insp-nested__row"
                  onClick={() => onOpen(i, title)}
                  aria-label={`Edit ${title}`}
                >
                  <span className="insp-nested__title">{title}</span>
                  <span className="insp-nested__chevron" aria-hidden="true">›</span>
                </button>
                <div className="insp-nested__actions">
                  {itemLabel && (
                    <button
                      type="button"
                      className="insp-nested__btn insp-nested__rename"
                      onClick={(e) => rowRename.openRename(i, e.currentTarget)}
                      aria-label={`Rename ${title}`}
                      aria-haspopup="dialog"
                    >✎</button>
                  )}
                  <button
                    type="button"
                    className="insp-nested__btn insp-nested__up"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${title} up`}
                  >↑</button>
                  <button
                    type="button"
                    className="insp-nested__btn insp-nested__down"
                    onClick={() => move(i, 1)}
                    disabled={i === items.length - 1}
                    aria-label={`Move ${title} down`}
                  >↓</button>
                  <button
                    type="button"
                    className="insp-nested__btn insp-nested__remove"
                    onClick={() => removeItem(i)}
                    aria-label={`Remove ${title}`}
                  >✕</button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <button
        type="button"
        className="insp-nested__btn insp-nested__add"
        onClick={add}
      >+ Add item</button>

      {/* SL-3 glance-weight micro-edit: rename this row in place, anchored to it —
          a single property pops OUT, the dock stays bounded (§3.2). */}
      {rowRename.popover}
    </div>
  )
}

// ── ObjectFormScreen — one object level, CONCERN-GROUPED (root Law 11) ─────────
//
//  This level's own fields are split into the SAME CONTENT·DATA·STYLE·LAYOUT·
//  BEHAVIOR spine the whole node uses (`ConcernGroups`), so a DRILLED part — a KPI
//  card, a chart axis, a table column — reads as calm and grouped as the whole-node
//  dock, never a flat re-mush (the owner's REFINE law extended to the drill path).
//  Scalar fields render inline; a nested array/object sub-field resolves (via the
//  registry) to ArrayOfControl/ObjectControl which, seeing the ONE DrillContext that
//  wraps every concern, renders as a drill row on the unified breadcrumb. So this
//  screen shows ONLY this level's own fields, grouped by concern, and drilling deeper
//  replaces the screen entirely.
//
function ObjectFormScreen({
  rootValue, dotPath, schema, depth, idPrefix, locale, onEmitRoot, onDrill,
}: {
  rootValue:  unknown
  dotPath:    string
  schema:     PropSchema
  depth:      number
  idPrefix:   string
  locale:     Locale
  onEmitRoot: (next: unknown) => void
  onDrill:    (field: PropField, title: string) => void
}): ReactNode {
  const obj = (readAt(rootValue, dotPath) ?? {}) as Record<string, unknown>
  const node: CanvasNode = { id: idPrefix, type: 'nested-item', props: obj, childIds: [] }
  const ctx  = useMemo<DrillHandle>(
    () => ({ baseDotPath: dotPath, depth, drill: onDrill }),
    [dotPath, depth, onDrill],
  )

  // Plane-filter FIRST (mirrors the whole-node path) so a concern holding only plumbing
  // (`plane:'system'`) drops instead of rendering an empty labelled box; then bucket the
  // visible fields by their declared concern. Facets are node-level, so none here ([]).
  const planes  = useVisiblePlanes()
  const visible = useMemo(() => filterSchemaByPlanes(schema, planes), [schema, planes])
  const buckets = useMemo(() => bucketByConcern(visible, []), [visible])

  return (
    <DrillContext.Provider value={ctx}>
      <ConcernGroups buckets={buckets} locale={locale} idBase={idPrefix} renderBucket={(b) => (
        <Inspector
          node={node}
          schemaSource={fixedSchemaSource(b.fields, [])}
          idPrefix={idPrefix}
          onChange={(subfield, next) =>
            onEmitRoot(writeAt(rootValue, joinPath(dotPath, subfield), next))}
        />
      )} />
    </DrillContext.Provider>
  )
}
