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
//  selection. D7.1b reworks it into PROGRESSIVE DISCLOSURE, benchmarked against
//  Sanity Studio (array-of-objects → click an item → focused edit view, others
//  collapse), Framer array controls, Figma "enter instance":
//
//    • An ARRAY renders as a LIST of collapsed SUMMARY ROWS — title + reorder +
//      remove + an open affordance. NO item's fields are shown in the list.
//    • Clicking a row DRILLS IN: the editor region shows ONLY that item's
//      itemSchema form, with a BREADCRUMB back to the list. No sibling is
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
import type { SchemaSource } from '../schemaSource'
import type { CanvasNode, Locale } from '../../types/constructor'
import { Inspector } from '../Inspector'
import { getAtPath, setAtPath } from '../showWhen'
import { readLocale } from '../localeString'
import { JsonControl } from './primitives'
import { useBreadcrumbSlot } from '../breadcrumbSlot'

// ── Drill-depth backstop ──────────────────────────────────────────────────────
//
//  itemSchema nesting is a finite DATA structure, so real drilling always
//  terminates. This guard exists ONLY for a malformed/cyclic itemSchema (a meta
//  bug): once the drill PATH reaches MAX_NESTING levels a nested field renders
//  the raw-JSON control instead of offering to drill further — bounded, never an
//  unbounded path.
//
const MAX_NESTING = 8

// ── Path helpers (dot-path grammar; empty path = the root value itself) ───────

/** Read a value at an absolute dot-path from the root; '' addresses the root. */
function readAt(root: unknown, dotPath: string): unknown {
  return dotPath === '' ? root : getAtPath(root, dotPath)
}
/** Immutable write at an absolute dot-path from the root; '' replaces the root. */
function writeAt(root: unknown, dotPath: string, value: unknown): unknown {
  return dotPath === '' ? value : setAtPath(root, dotPath, value)
}
/** Append a segment to a dot-path ('' base → the segment alone). */
function joinPath(base: string, seg: string): string {
  return base === '' ? seg : `${base}.${seg}`
}
/** Namespace a DOM id by dot-path so each drill level's controls never collide. */
function pathToId(prefix: string, dotPath: string): string {
  return dotPath === '' ? prefix : `${prefix}-${dotPath.replace(/\./g, '-')}`
}

// ── Helpers (pure) ────────────────────────────────────────────────────────────

/** A SchemaSource that returns a FIXED schema + groups (the field's itemSchema),
 *  independent of the modeled node — the port the level Inspector reads. */
function fixedSchemaSource(schema: PropSchema, groups: PropertyGroup[]): SchemaSource {
  return { getSchema: () => schema, getGroups: () => groups }
}

/** Seed a fresh item from its schema's declared defaults (immutable build). */
function makeDefaultItem(schema: PropSchema): Record<string, unknown> {
  let out: Record<string, unknown> = {}
  for (const f of schema) {
    if (f.default !== undefined) out = setAtPath(out, f.field, f.default)
  }
  return out
}

/** A field's display label, active-locale-resolved (LocaleString | string). */
function fieldLabel(field: PropField, locale: Locale): string {
  return readLocale(field.label as never, locale) || field.field
}

/** Display title for an item: the `itemLabel` dot-path value (locale-resolved for
 *  a LocaleString), else the 1-based "Item N" fallback. */
function itemTitle(
  item: unknown, itemLabel: string | undefined, index: number, locale: Locale,
): string {
  const fallback = `Item ${index + 1}`
  if (!itemLabel) return fallback
  const raw = getAtPath(item, itemLabel)
  if (raw == null) return fallback
  if (typeof raw === 'string') return raw || fallback
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw)
  if (typeof raw === 'object') {
    const s = readLocale(raw as never, locale) // LocaleString or similar record
    return s || fallback
  }
  return fallback
}

/** Row summary for a nested ARRAY drill-affordance (count, no fields shown). */
function summarizeArray(value: unknown): string {
  const n = Array.isArray(value) ? value.length : 0
  return n === 0 ? 'No items' : n === 1 ? '1 item' : `${n} items`
}

/** Row summary for a nested OBJECT drill-affordance (its itemLabel value, if any). */
function summarizeObject(value: unknown, field: PropField, locale: Locale): string {
  if (field.itemLabel) return itemTitle(value, field.itemLabel, 0, locale)
  return ''
}

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
  props: FieldControlProps & { rootKind: LevelKind },
): ReactNode {
  const { field, id, value, onChange, locale, rootKind } = props

  const rootLabel = fieldLabel(field, locale)

  // The steps the author has drilled into, beyond the root (component-local UI
  // state — like the canvas selection, never config).
  const [steps, setSteps] = useState<Step[]>([])

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

  // Drill into a nested field of the CURRENT object screen (append a crumb).
  const drill = useCallback((f: PropField, title: string) => {
    setSteps((prev) => [...prev, {
      seg:       f.field,
      label:     title,
      kind:      f.type === 'array' ? 'array' : 'object',
      schema:    f.itemSchema ?? [],
      groups:    f.itemGroups ?? [],
      itemLabel: f.itemLabel,
    }])
  }, [])

  // Open an item of the CURRENT array screen (its fields = the array's itemSchema).
  const openItem = (index: number, title: string) =>
    setSteps((prev) => [...prev, {
      seg:            String(index),
      label:          title,
      kind:           'object',
      schema:         deepest.schema,
      groups:         deepest.groups,
      isItem:         true,
      titleItemLabel: deepest.itemLabel,
    }])

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
            groups={deepest.groups}
            depth={activeCrumbs.length}
            idPrefix={pathToId(id, deepest.dotPath)}
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
    </div>
  )
}

// ── ObjectFormScreen — one object level authored by the generic Inspector ─────
//
//  Scalar fields render inline; nested array/object sub-fields resolve (via the
//  registry) to ArrayOfControl/ObjectControl which, seeing the DrillContext,
//  render as drill rows. So this screen shows ONLY this level's own fields, and
//  drilling deeper replaces the screen entirely.
//
function ObjectFormScreen({
  rootValue, dotPath, schema, groups, depth, idPrefix, onEmitRoot, onDrill,
}: {
  rootValue:  unknown
  dotPath:    string
  schema:     PropSchema
  groups:     PropertyGroup[]
  depth:      number
  idPrefix:   string
  onEmitRoot: (next: unknown) => void
  onDrill:    (field: PropField, title: string) => void
}): ReactNode {
  const source = useMemo(() => fixedSchemaSource(schema, groups), [schema, groups])
  const obj = (readAt(rootValue, dotPath) ?? {}) as Record<string, unknown>
  const node: CanvasNode = { id: idPrefix, type: 'nested-item', props: obj, childIds: [] }
  const ctx  = useMemo<DrillHandle>(
    () => ({ baseDotPath: dotPath, depth, drill: onDrill }),
    [dotPath, depth, onDrill],
  )

  return (
    <DrillContext.Provider value={ctx}>
      <Inspector
        node={node}
        schemaSource={source}
        idPrefix={idPrefix}
        onChange={(subfield, next) =>
          onEmitRoot(writeAt(rootValue, joinPath(dotPath, subfield), next))}
      />
    </DrillContext.Provider>
  )
}
