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
//  Pick-don't-type (Law 2): `frame` is a static-option select; `vars` is the
//  documented object JSON sub-editor (the same escape hatch FilterSchema bars +
//  op-schema collections use). `perspectives` is NO LONGER a raw JSON field here —
//  the dedicated PerspectivesPane (features/perspectives, P-final) authors the
//  PerspectiveAxis through the generic Inspector + VisibilityBuilder, replacing the
//  raw object sub-editor with the named-ordered-list pane (Power BI bookmark-pane IA).
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
    // NOTE: `perspectives` is authored by the dedicated PerspectivesPane (P-final),
    // NOT a raw JSON field here — the named-ordered-list pane replaces the object
    // sub-editor (Power BI bookmark-pane IA, schema-driven scope fields).
    //
    // Generic page-scoped derived VARIABLES — the page's derive-graph (`_selKey`,
    // `regionObj`, `_direct…`). This is PLUMBING, not authoring: `plane:'system'` so
    // it never renders on the author plane (root Law 11 · ADR-043). Reachable only
    // under a system lens; the author binds governed nouns, never a derive-graph.
    { field: 'vars',      type: 'object', label: { ka: 'ცვლადები',       en: 'Variables' }, plane: 'system' },
  ]
}

/** The page-root property-panel grouping (accordion sections). */
export function pageGroups(): PropertyGroup[] {
  const presentationFields = presentationPropSchema().map((f) => `presentation.${f.field}`)
  return [
    { label: { ka: 'განლაგება',    en: 'Layout'       }, fields: ['frame'] },
    { label: { ka: 'პრეზენტაცია',  en: 'Presentation' }, fields: presentationFields },
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
