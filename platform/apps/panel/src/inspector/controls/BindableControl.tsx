// ── BindableControl — the literal ↔ bind (⚡) affordance around a scalar control ──
//
//  The Builder.io ⚡ / Retool `{{ }}` gesture, projected onto the generic Inspector: a
//  scalar field can hold a FIXED value OR a live expression `{ $bind: "<expr>" }`. This
//  wrapper adds a ⚡ toggle beside the field's control and swaps the control for an expr
//  editor + a live-evaluated preview when the field is bound.
//
//  ONE seam, not per-control (OCP): the Inspector routes EVERY field's control through
//  this wrapper; a field simply opts in when its type is bindable. The wrapped control is
//  the SAME registry-resolved FieldControl (literal mode is byte-identical to before —
//  the wrapper renders <Control> untouched). The bound value the toggle writes is the
//  serializable `{ $bind }` marker the render pipeline resolves at its own seam (Law 2 —
//  data, not code; the store write composes with undo/redo exactly like any other edit).
//
import { useMemo } from 'react'
import { isBinding, resolveBinding } from '@statdash/react/engine'
import type { Binding } from '@statdash/react/engine'
import type { FieldControl, FieldControlProps } from '../fieldControl.types'
import './BindableControl.css'

// The scalar types a value may be BOUND for in this slice. The value MODEL generalizes
// to every type (the render seam resolves any $bind); the affordance is gated here to the
// scalar controls where a literal↔expr swap is unambiguous — a deliberate, documented
// slice boundary, widened by adding a type to this set (no seam change).
const BINDABLE_TYPES = new Set(['string', 'number', 'color', 'LocaleString'])

// Preview scope — the Inspector lives OUTSIDE the live render context, so the preview
// evaluates against an EMPTY scope: it catches malformed exprs immediately and shows a
// self-contained constant, while an expr that references the author's live selections
// resolves to no-data here and is annotated "resolves live on the canvas" (the canvas is
// the authoritative live surface — DoD). Richer in-Inspector live scope is a refinement.
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

export interface BindableControlProps extends FieldControlProps {
  /** The registry-resolved control for this field (rendered in literal mode). */
  Control: FieldControl
}

export function BindableControl({ Control, ...props }: BindableControlProps) {
  const { field, id, value, onChange } = props
  const bindable = BINDABLE_TYPES.has(field.type)
  const bound    = isBinding(value)

  if (!bindable) {
    return <Control {...props} />
  }

  const toggle = () => {
    // literal → bind: seed an empty expr the author fills in.
    // bind → literal: fall back to the field default (or empty), a clean fixed value.
    onChange(bound ? (field.default ?? '') : { $bind: '' })
  }

  return (
    <div className="insp-bind" data-bound={bound || undefined}>
      <div className="insp-bind__row">
        <div className="insp-bind__control">
          {bound
            ? <BindEditor id={id} value={value as Binding} onChange={onChange} />
            : <Control {...props} />}
        </div>
        <button
          type="button"
          className="insp-bind__toggle"
          aria-pressed={bound}
          title={bound ? 'Use a fixed value' : 'Bind to a live expression'}
          aria-label={bound ? 'Use a fixed value' : 'Bind to a live expression'}
          onClick={toggle}
        >
          <span aria-hidden="true">⚡</span>
        </button>
      </div>
    </div>
  )
}

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
