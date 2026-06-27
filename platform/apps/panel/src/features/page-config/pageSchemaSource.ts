// ── pageSchemaSource — Inspector schema port for the PAGE ROOT [V3] ───────────
//
//  The Constructor's ONE generic Inspector renders any element's property panel
//  from a PropSchema resolved through a SchemaSource port. The PAGE ROOT is just
//  another such element: its config is `PageConfigBase` (presentation · frame ·
//  perspectives · vars · page-root kind), carried losslessly in `page.meta`
//  (canvasPageAdapter structural pass-through, P-3). This source returns the
//  page-root's PropSchema — so the page is authored by the SAME Inspector that
//  renders node / panel / chrome / transform-step / filter-control properties,
//  with NO bespoke page form (the ADR mandate, mirroring filterParamSchemaSource).
//
//  `presentation` is NOT hand-listed: it is `presentationPropSchema()` — the
//  union of every REGISTERED presentation projector's schema() — re-prefixed to
//  the `presentation.` dot-path the Inspector reads/writes. A new projector's
//  PropField appears here automatically (OCP / Law 1), zero edits.
//
//  Pick-don't-type (Law 2): `frame` is a static-option select; `perspectives`/`vars`
//  are the documented object JSON sub-editor (the same escape hatch FilterSchema
//  bars + op-schema collections use). A bespoke Perspectives panel is a later slice.
//
//  Page-root KIND (`type`) is deliberately NOT authored here: the adapter
//  (canvasPageAdapter) hardwires the root to `inner-page` and strips `type` from
//  `meta` (PAGE_STRUCTURAL_KEYS), so a `type` value would not take effect — and
//  carrying it would break the "meta-less page → no spurious meta" round-trip
//  invariant. Promoting the kind to authorable is a deeper adapter reshape, out
//  of scope for this additive slice (the prompt's "kind WHERE editable").
//
import { presentationPropSchema } from '@statdash/react/engine'
import type { PropField, PropSchema, PropertyGroup } from '@statdash/react/engine'
import type { SchemaSource } from '../../inspector/schemaSource'

// ── Known layout frames (PageConfigBase.frame — open string, known set) ───────
//  The frame names AppChrome reads for page geometry (data-frame on .app-shell).
//  Open string at the type level, but a known, pickable set at authoring time.
const FRAME_OPTIONS: PropField['options'] = [
  { value: 'default', label: { ka: 'ნაგულისხმევი', en: 'Default' } },
  { value: 'landing', label: { ka: 'სადესანტო',     en: 'Landing' } },
  { value: 'minimal', label: { ka: 'მინიმალური',    en: 'Minimal' } },
  { value: 'canvas',  label: { ka: 'ტილო',          en: 'Canvas' } },
]

/**
 * The page-root PropSchema = identity/layout fields + the projected presentation
 * schema. `presentation.*` fields are the registered projectors' own schemas,
 * re-prefixed to the dot-path the Inspector reads (`presentation.color`, …).
 * Built lazily (a function, not a const) because projectors register at app boot
 * — at module-eval time the registry may be empty.
 */
export function pageSchema(): PropSchema {
  const presentation: PropField[] = presentationPropSchema().map((f) => ({
    ...f,
    field: `presentation.${f.field}`,
  }))

  return [
    { field: 'frame', type: 'string', label: { ka: 'ჩარჩო', en: 'Frame' }, options: FRAME_OPTIONS },
    ...presentation,
    // The page's perspective axes, keyed by URL param (the perspectives[] order is
    // the toggle + nav-sort SSOT). The object JSON sub-editor (the documented
    // collection escape hatch) — a bespoke Perspectives panel is a later slice.
    { field: 'perspectives', type: 'object', label: { ka: 'პერსპექტივები', en: 'Perspectives' } },
    // Generic page-scoped derived variables (zero reserved keys — Law 1). The
    // object JSON sub-editor, exactly like node `vars`.
    { field: 'vars',      type: 'object', label: { ka: 'ცვლადები',       en: 'Variables' } },
  ]
}

/** The page-root property-panel grouping (accordion sections). */
export function pageGroups(): PropertyGroup[] {
  const presentationFields = presentationPropSchema().map((f) => `presentation.${f.field}`)
  return [
    { label: { ka: 'განლაგება',    en: 'Layout'       }, fields: ['frame'] },
    { label: { ka: 'პრეზენტაცია',  en: 'Presentation' }, fields: presentationFields },
    { label: { ka: 'პერსპექტივები', en: 'Perspectives' }, fields: ['perspectives'] },
    { label: { ka: 'ცვლადები',     en: 'Variables'    }, fields: ['vars'] },
  ]
}

/**
 * SchemaSource for the page root. The schema is page-identity-independent (the
 * page is always the same kind of element), so it ignores the passed node and
 * returns the page-root schema/groups. The PageInspectorPanel models the page's
 * `meta` as a CanvasNode (`{ type: 'inner-page', props: meta }`) so the SAME
 * Inspector path renders it.
 */
export const pageSchemaSource: SchemaSource = {
  getSchema: () => pageSchema(),
  getGroups: () => pageGroups(),
}
