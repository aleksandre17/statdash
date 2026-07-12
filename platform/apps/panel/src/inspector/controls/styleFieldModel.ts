// ── styleFieldModel — the StyleField's pure, framework-free authoring model ──────
//
//  The token-constrained STYLE facet MVP (DESIGN-framework-grade-style-system S0/S1):
//  a curated, grouped set of whole-element `NodeStyles` properties, each authored from
//  a design-token picker (constrain-by-default) with a raw escape (Tailwind `[13px]`
//  discipline). Kept PURE (no React) so the write law — immutable, byte-clean, lossless
//  round-trip — is unit-testable in isolation (FF-STYLE-ROUNDTRIP).
//
//  Property scope: only `NodeStyles` axes whose value type accepts a `var(--*)` string
//  (spacing/shape/color/typography/effects). Responsive per-breakpoint authoring and
//  per-part reach (DESIGN S2) are deliberately deferred — no empty cathedral; the MVP
//  is whole-element flat values, which `resolveStyle`/`applyNodeStyles` already renders.
//
import type { NodeStyles, TokenGroup } from '@statdash/styles'
import type { LocaleString } from '@statdash/react/engine'

/** One authorable style property — a `NodeStyles` key bound to a token group. */
export interface StyleProperty {
  /** The `NodeStyles` key this row writes (also the dot-path segment under view.styles). */
  key:        string
  label:      LocaleString
  /** The `TOKENS_CATALOG` group the picker is constrained to. */
  tokenGroup: TokenGroup
}

/** A labelled group of style properties (mirrors the token catalog's own grouping). */
export interface StylePropertyGroup {
  label: LocaleString
  props: StyleProperty[]
}

/**
 * The curated MVP property set. Each property's value type (checked against NodeStyles)
 * accepts a `var(--*)` string, so a token pick serializes losslessly. A new property =
 * one entry here; the control renders it for free (no per-property code).
 */
export const STYLE_PROPERTY_GROUPS: StylePropertyGroup[] = [
  {
    label: { ka: 'ინტერვალები', en: 'Spacing' },
    props: [
      { key: 'padding', label: { ka: 'შიდა ინტერვალი', en: 'Padding' }, tokenGroup: 'spacing' },
      { key: 'margin',  label: { ka: 'გარე ინტერვალი',  en: 'Margin'  }, tokenGroup: 'spacing' },
      { key: 'gap',     label: { ka: 'შუალედი',          en: 'Gap'     }, tokenGroup: 'spacing' },
    ],
  },
  {
    label: { ka: 'ფორმა', en: 'Shape' },
    props: [
      { key: 'borderRadius', label: { ka: 'კუთხის მომრგვალება', en: 'Corner radius' }, tokenGroup: 'radii' },
      { key: 'borderWidth',  label: { ka: 'ჩარჩოს სისქე',        en: 'Border width'  }, tokenGroup: 'border-width' },
    ],
  },
  {
    label: { ka: 'ფერი', en: 'Color' },
    props: [
      { key: 'color',           label: { ka: 'ტექსტის ფერი', en: 'Text color'       }, tokenGroup: 'color' },
      { key: 'backgroundColor', label: { ka: 'ფონის ფერი',   en: 'Background color'  }, tokenGroup: 'color' },
      { key: 'borderColor',     label: { ka: 'ჩარჩოს ფერი',  en: 'Border color'      }, tokenGroup: 'color' },
    ],
  },
  {
    label: { ka: 'ტიპოგრაფია', en: 'Typography' },
    props: [
      { key: 'fontSize',   label: { ka: 'შრიფტის ზომა',  en: 'Font size'   }, tokenGroup: 'font-size' },
      { key: 'fontWeight', label: { ka: 'შრიფტის სისქე', en: 'Font weight' }, tokenGroup: 'font-weight' },
      { key: 'lineHeight', label: { ka: 'ხაზის სიმაღლე', en: 'Line height' }, tokenGroup: 'line-height' },
    ],
  },
  {
    label: { ka: 'ეფექტები', en: 'Effects' },
    props: [
      { key: 'boxShadow', label: { ka: 'ჩრდილი', en: 'Shadow' }, tokenGroup: 'shadow' },
    ],
  },
]

/**
 * Immutable single-property write. Empty/undefined CLEARS the property; when the last
 * property is cleared the whole `view.styles` collapses to `undefined` (byte-clean
 * round-trip — no `{}` residue, mirroring the visibility clear). Never mutates input.
 */
export function setStyleProp(
  styles: NodeStyles | undefined,
  key:    string,
  value:  string | undefined,
): NodeStyles | undefined {
  const next: Record<string, unknown> = { ...(styles ?? {}) }
  if (value === undefined || value === '') delete next[key]
  else next[key] = value
  return Object.keys(next).length ? (next as NodeStyles) : undefined
}

/**
 * The current FLAT value of a style property, as an authoring string. A per-breakpoint
 * (responsive-object) value returns '' — the MVP control authors the flat axis only and
 * never clobbers an existing responsive value it can't represent.
 */
export function flatStyleValue(styles: NodeStyles | undefined, key: string): string {
  const v = (styles as Record<string, unknown> | undefined)?.[key]
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return ''
}

/** True when a value is a design-token reference (a `var(--*)`), vs a raw escape value. */
export function isTokenValue(value: string): boolean {
  return /^var\(--[\w-]+\)$/.test(value.trim())
}
