// ── StructuredValueView — the reference-class themed JSON/config tree (craft) ─────
//
//  Where a STRUCTURE legitimately renders (a steward/system-plane config value, a
//  raw JSON escape, the escalated read-only detail of a rich value), it must render
//  as a proper, token-themed, collapsible TREE — the Stripe/Retool/Linear idiom —
//  NEVER a raw `object · 6 fields · by · op` text dump (the disease in screenshot 04).
//
//  Built on `react-json-view-lite` (0-dep, ~4 KB, TS-native, React 19): the maintained
//  small-viewer the platform picks over a bespoke tree. We DON'T import its stock CSS —
//  every style slot is bound to OUR inspector DTCG tokens (StructuredValueView.css), so
//  the tree matches the dock (light/dark) instead of shipping a foreign skin.
//
//  Contextual-relevance canon (drill-in, never all-expanded): the top level expands,
//  deeper levels collapse to a click-to-open affordance — the tree is bounded, not a
//  wall of nested braces. Read-only by design: structured EDITING is the Stage / Chart
//  Studio; this is the truthful, legible viewer of what the value IS.
//
import { JsonView, defaultStyles } from 'react-json-view-lite'
import './StructuredValueView.css'

// The style-slot → token-themed class map. `react-json-view-lite` applies THESE classes
// (via the `style` prop) instead of its stock ones, so all theming is ours. Every visual
// slot maps to a BEM class in StructuredValueView.css bound to `--insp-*` tokens; the
// lib's behaviour defaults (aria labels, string-stringify) ride along via the spread.
const THEMED_STYLE = {
  ...defaultStyles,
  container:            'sv-json',
  basicChildStyle:      'sv-json__row',
  label:                'sv-json__label',
  clickableLabel:       'sv-json__label sv-json__label--clickable',
  nullValue:            'sv-json__value sv-json__null',
  undefinedValue:       'sv-json__value sv-json__undefined',
  numberValue:          'sv-json__value sv-json__number',
  stringValue:          'sv-json__value sv-json__string',
  booleanValue:         'sv-json__value sv-json__boolean',
  otherValue:           'sv-json__value sv-json__other',
  punctuation:          'sv-json__punctuation',
  expandIcon:           'sv-json__icon sv-json__icon--expand',
  collapseIcon:         'sv-json__icon sv-json__icon--collapse',
  collapsedContent:     'sv-json__collapsed',
  childFieldsContainer: 'sv-json__children',
} as const

export interface StructuredValueViewProps {
  /** The value to render as a tree. Objects/arrays render as a tree; a scalar renders
   *  as a single typed leaf; null/undefined render a designed empty state. */
  value:   unknown
  /** How deep to auto-expand (default 1 — the top level only; deeper drills in). */
  expandToLevel?: number
  testId?: string
}

/** The designed empty state — never a bare "—"/"not set" dead-end (craft bar). */
function StructuredEmpty({ testId }: { testId?: string }): React.ReactNode {
  return (
    <div className="sv-json sv-json--empty" data-testid={testId}>
      <span className="sv-json__empty-glyph" aria-hidden="true">{'{ }'}</span>
      <span className="sv-json__empty-text">No structure yet</span>
    </div>
  )
}

export function StructuredValueView({
  value, expandToLevel = 1, testId = 'structured-value',
}: StructuredValueViewProps): React.ReactNode {
  // Empty / absent → a designed placeholder, not a raw-text dead-end.
  const isEmptyObject =
    value != null && typeof value === 'object' && Object.keys(value as object).length === 0
  if (value == null || isEmptyObject) return <StructuredEmpty testId={testId} />

  // A scalar is not a tree — wrap it so the viewer always has an object/array to render,
  // keeping ONE render idiom (the leaf shows under a synthetic `value` key).
  const data: object | unknown[] =
    Array.isArray(value) || typeof value === 'object'
      ? (value as object | unknown[])
      : { value }

  return (
    <div className="sv-json-frame" data-testid={testId}>
      <JsonView
        data={data}
        style={THEMED_STYLE}
        shouldExpandNode={(level) => level < expandToLevel}
        clickToExpandNode
      />
    </div>
  )
}
