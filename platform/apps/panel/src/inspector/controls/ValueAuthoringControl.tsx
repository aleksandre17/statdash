// ── ValueAuthoringControl — the ONE value-authoring wrapper (mode: fixed·bound·responsive) ──
//
//  The coherent successor to the standalone bind wrapper: a SINGLE control around every
//  inspector field that presents the value's MODE, so authoring is one model, not three
//  bolt-on layers. A property value can be:
//    • FIXED       — a plain literal `T`                            (the Control, untouched)
//    • BOUND        — `{ $bind: "<expr>" }` (Builder.io ⚡ / Retool)   (the expr editor + live preview)
//    • RESPONSIVE   — `{ default?, md?, lg?, … }` per-breakpoint map  (edit AT the active breakpoint)
//  and the modes COMPOSE: a per-breakpoint entry is itself authored through this SAME
//  control (recursively), so a single breakpoint's value may be a literal OR a binding.
//  The render seam already honours all of it — resolveBindings deep-walks a responsive
//  object and resolves a `{ $bind }` inside a breakpoint entry; resolveResponsive lowers
//  the map to the container-query cascade.
//
//  ONE seam (OCP), zero per-type wiring: the Inspector routes EVERY field's control
//  through this wrapper. A field opts into BINDING by its scalar `type`, and into
//  RESPONSIVE by its declared `responsive` flag (Law 8 — a new capability = a populated
//  flag; the wrapper, registry, and Inspector are unchanged). A field with NEITHER
//  capability renders the bare Control, reference-identical to no wrapper at all.
//
//  HONEST STATES (root Law 11): an unset breakpoint inherits the nearest LARGER set value
//  (identical to the CSS `var()` fallback the renderer uses) — shown as an explicit
//  "inherited" annotation, never fabricated. A bound expr that resolves to no-data/error
//  is surfaced by the preview, never a fake value.
//
import { useMemo } from 'react'
import { isBinding, resolveBinding } from '@statdash/react/engine'
import type { Binding } from '@statdash/react/engine'
import { isResponsiveObject, BREAKPOINT_KEYS_CASCADE } from '@statdash/styles'
import type { FieldControl, FieldControlProps } from '../fieldControl.types'
import { useActiveBreakpoint } from '../../studio/activeBreakpoint'
import './ValueAuthoringControl.css'

// The scalar types a value may be BOUND for. The value MODEL generalizes to every type
// (the render seam resolves any $bind); the affordance is gated here to the scalar
// controls where a literal↔expr swap is unambiguous — widened by adding a type here.
const BINDABLE_TYPES = new Set(['string', 'number', 'color', 'LocaleString'])

// Preview scope — the Inspector lives OUTSIDE the live render context, so the preview
// evaluates against an EMPTY scope: it catches malformed exprs immediately and shows a
// self-contained constant, while an expr referencing the author's live selections
// resolves to no-data here and is annotated "resolves live on the canvas".
const PREVIEW_SCOPE = { dims: {}, derived: {} } as const

interface PreviewResult {
  kind: 'ok' | 'error' | 'live' | 'empty'
  text: string
}

function previewBinding(expr: string): PreviewResult {
  if (!expr.trim()) return { kind: 'empty', text: 'Enter an expression (e.g. year, or 2 + 2)' }
  const r = resolveBinding({ $bind: expr }, PREVIEW_SCOPE)
  if (r.state === 'error')   return { kind: 'error', text: r.message ?? 'Invalid expression' }
  if (r.state === 'no-data') return { kind: 'live', text: 'Valid — resolves live on the canvas' }
  return { kind: 'ok', text: `= ${String(r.value)}` }
}

export interface ValueAuthoringControlProps extends FieldControlProps {
  /** The registry-resolved control for this field (rendered in fixed mode). */
  Control: FieldControl
  /**
   * Allow the per-breakpoint RESPONSIVE mode (default true — gated further by the field's
   * declared `responsive` flag). A breakpoint ENTRY passes `false`: an entry is fixed OR
   * bound, never itself nested-responsive (one level of breakpoints — the render model).
   */
  allowResponsive?: boolean
}

/** Resolve a breakpoint's EFFECTIVE value + where it inherits from — the nearest LARGER
 *  set breakpoint (identical to the CSS `var()` fallback the renderer uses). When the
 *  breakpoint is itself set, that value is effective with no inheritance. */
function resolveInherited(
  obj:   Record<string, unknown>,
  bp:    string,
  entry: unknown,
  isSet: boolean,
): { effective: unknown; inheritedFrom: string | undefined } {
  if (isSet) return { effective: entry, inheritedFrom: undefined }
  const chain = BREAKPOINT_KEYS_CASCADE // ['default','2xl','xl','lg','md','sm','xs']
  const idx = chain.indexOf(bp as (typeof BREAKPOINT_KEYS_CASCADE)[number])
  for (let i = idx - 1; i >= 0; i--) {
    const k = chain[i]
    if (obj[k] !== undefined) return { effective: obj[k], inheritedFrom: k }
  }
  return { effective: undefined, inheritedFrom: undefined }
}

/** Seed a responsive object from the current value (nothing lost — the literal/binding
 *  becomes the `default` base entry). Idempotent when already responsive. */
function seedResponsive(value: unknown, fallback: unknown): Record<string, unknown> {
  if (isResponsiveObject(value)) return value as Record<string, unknown>
  const base = value ?? fallback
  return base === undefined ? {} : { default: base }
}

/** Collapse a responsive/bound value back to a fixed literal (the `default` entry, else fallback). */
function toFixed(value: unknown, fallback: unknown): unknown {
  if (isResponsiveObject(value)) return (value as Record<string, unknown>).default ?? fallback ?? ''
  if (isBinding(value))          return fallback ?? ''
  return value
}

export function ValueAuthoringControl({ Control, allowResponsive = true, ...props }: ValueAuthoringControlProps) {
  const { field, value, onChange } = props
  const bindable      = BINDABLE_TYPES.has(field.type)
  const responsiveCap = allowResponsive && (field as { responsive?: boolean }).responsive === true

  const bound = isBinding(value)
  const perBp = responsiveCap && isResponsiveObject(value)

  // No capability applies → the bare Control, reference-identical to no wrapper (Law 8).
  if (!bindable && !responsiveCap) {
    return <Control {...props} />
  }

  const toggleBind = () =>
    onChange(bound ? toFixed(value, field.default) : { $bind: '' })
  const toggleResponsive = () =>
    onChange(perBp ? toFixed(value, field.default) : seedResponsive(value, field.default))

  return (
    <div className="insp-bind" data-bound={bound || undefined} data-responsive={perBp || undefined}>
      <div className="insp-bind__row">
        <div className="insp-bind__control">
          {perBp
            ? <ResponsiveEditor Control={Control} {...props} />
            : bound
              ? <BindEditor id={props.id} value={value as Binding} onChange={onChange} />
              : <Control {...props} />}
        </div>
        <div className="insp-va__modes">
          {bindable && (
            <button
              type="button"
              className="insp-bind__toggle"
              aria-pressed={bound}
              title={bound ? 'Use a fixed value' : 'Bind to a live expression'}
              aria-label={bound ? 'Use a fixed value' : 'Bind to a live expression'}
              onClick={toggleBind}
            >
              <span aria-hidden="true">⚡</span>
            </button>
          )}
          {responsiveCap && (
            <button
              type="button"
              className="insp-bind__toggle insp-va__responsive"
              aria-pressed={perBp}
              title={perBp ? 'Use one value for all breakpoints' : 'Author a value per breakpoint'}
              aria-label={perBp ? 'Use one value for all breakpoints' : 'Author a value per breakpoint'}
              onClick={toggleResponsive}
            >
              <span aria-hidden="true">⧉</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── ResponsiveEditor — edit ONE breakpoint's entry of a responsive value ──────
//
//  Reads the Studio's ACTIVE breakpoint (the Builder.io switcher) and edits THAT entry
//  of the responsive map through the SAME ValueAuthoringControl (recursively — so a
//  breakpoint's value can be a literal or a binding), never a nested responsive. An unset
//  non-base breakpoint HONESTLY shows the value it inherits from the nearest larger set
//  breakpoint (mirrors the CSS var() fallback), annotated as inherited (Law 11).
//
function ResponsiveEditor({ Control, ...props }: ValueAuthoringControlProps) {
  const { field, id, value, onChange, locales, locale, siblingValues } = props
  const { bp } = useActiveBreakpoint()

  const obj   = (isResponsiveObject(value) ? value : {}) as Record<string, unknown>
  const entry = obj[bp]
  const isSet = entry !== undefined

  // Nearest LARGER set value → the honest inherited effective value (CSS var() fallback).
  // Cheap pure walk over the fixed 7-key cascade — computed each render (the React
  // Compiler memoizes; no manual useMemo, which this data shape can't stabilize).
  const inherit = resolveInherited(obj, bp, entry, isSet)
  const { effective, inheritedFrom } = inherit

  const setEntry = (next: unknown) => {
    const nextObj: Record<string, unknown> = { ...obj }
    if (next === undefined || next === '') delete nextObj[bp]
    else nextObj[bp] = next
    onChange(nextObj)
  }

  const isBase = bp === 'default'

  return (
    <div className="insp-va__bp" data-testid="responsive-editor" data-bp={bp}>
      <div className="insp-va__bp-head">
        <span className="insp-va__bp-label">
          {isBase ? 'ბაზა' : bp.toUpperCase()}
        </span>
        {!isSet && !isBase && (
          <span className="insp-va__bp-inherit" data-testid="bp-inherited">
            {inheritedFrom
              ? `მემკვიდრეობით — ${inheritedFrom === 'default' ? 'ბაზა' : inheritedFrom.toUpperCase()}`
              : 'მემკვიდრეობით — ბაზა'}
          </span>
        )}
        {isSet && !isBase && (
          <button
            type="button"
            className="insp-va__bp-clear"
            onClick={() => setEntry(undefined)}
            title="ამ breakpoint-ის მნიშვნელობის გასუფთავება"
            aria-label="clear this breakpoint value"
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>
      {/* The breakpoint entry — authored through the SAME wrapper (fixed or bound; not
          nested-responsive). Shows the inherited value so the author edits FROM the truth. */}
      <ValueAuthoringControl
        Control={Control}
        allowResponsive={false}
        field={field}
        id={`${id}-bp-${bp}`}
        value={effective}
        locales={locales}
        locale={locale}
        siblingValues={siblingValues}
        onChange={setEntry}
      />
    </div>
  )
}

// ── BindEditor — the expr editor + live-evaluated preview (the ⚡ / `{{ }}` body) ──
function BindEditor({
  id,
  value,
  onChange,
}: {
  id:       string
  value:    Binding
  onChange: (next: Binding) => void
}) {
  const expr    = value.$bind
  const preview = useMemo(() => previewBinding(expr), [expr])

  return (
    <div className="insp-bind__editor">
      <input
        id={id}
        className="insp-bind__expr"
        type="text"
        value={expr}
        spellCheck={false}
        autoComplete="off"
        placeholder="expression — e.g. year"
        onChange={(e) => onChange({ $bind: e.target.value })}
      />
      <p
        className={`insp-bind__preview insp-bind__preview--${preview.kind}`}
        role="status"
        aria-live="polite"
      >
        {preview.text}
      </p>
    </div>
  )
}
