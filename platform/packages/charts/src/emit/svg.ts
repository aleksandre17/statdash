// ── SVG string primitives — pure, DOM-free ─────────────────────────────
//
//  The ChartEmitter builds an SVG document as a STRING (server-usable: no
//  `document`, no `createElementNS`, no browser). These helpers are the only
//  place that concatenates markup, so escaping is centralised here — every text
//  value and attribute flows through `esc` / `attr`, closing the injection hole
//  a hand-built template string would open (a category label or unit that
//  contains `<`, `&`, or `"` must never break the document).
//
//  Deterministic by construction: numbers are rounded to a fixed precision so
//  the same ChartOutput always yields byte-identical SVG (snapshot-stable,
//  diffable). No floating-point tail noise (0.1+0.2) reaches the output.
//

/** Fixed coordinate precision — keeps output deterministic + compact. */
const PRECISION = 2

/** Round a coordinate to the fixed precision; `-0` normalised to `0`. */
export function num(n: number): string {
  if (!Number.isFinite(n)) return '0'
  const r = Number(n.toFixed(PRECISION))
  return String(Object.is(r, -0) ? 0 : r)
}

/** Escape text content for XML (`&`, `<`, `>`). */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Escape an attribute value (adds quote + control-char safety on top of `esc`). */
export function escAttr(s: string): string {
  return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** A single attribute map → ` k="v"` string; nullish/false values are dropped. */
export type Attrs = Record<string, string | number | boolean | undefined | null>

export function attrs(a: Attrs): string {
  let out = ''
  for (const k in a) {
    const v = a[k]
    if (v === undefined || v === null || v === false) continue
    if (v === true) { out += ` ${k}`; continue }
    const val = typeof v === 'number' ? num(v) : escAttr(String(v))
    out += ` ${k}="${val}"`
  }
  return out
}

/** Self-closing element (`<tag …/>`). */
export function el(tag: string, a: Attrs): string {
  return `<${tag}${attrs(a)}/>`
}

/** Container element with raw child markup (`<tag …>children</tag>`). */
export function elC(tag: string, a: Attrs, children: string): string {
  return `<${tag}${attrs(a)}>${children}</${tag}>`
}

/** `<text>` element — content is escaped, never raw. */
export function text(content: string, a: Attrs): string {
  return elC('text', a, esc(content))
}

/** `<g>` group wrapping already-built child markup. */
export function group(a: Attrs, children: string): string {
  return elC('g', a, children)
}

/** Build the root `<svg>` document with a viewBox. */
export function svgDoc(width: number, height: number, a: Attrs, body: string): string {
  return elC('svg', {
    xmlns:     'http://www.w3.org/2000/svg',
    width,
    height,
    viewBox:   `0 0 ${num(width)} ${num(height)}`,
    ...a,
  }, body)
}
