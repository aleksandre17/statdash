// ── perspectiveDefSchemaSource — Inspector schema port for a PerspectiveDef [P-final] ──
//
//  The PerspectiveDef's SCALAR fields (label · icon) + its registry-driven SCOPE
//  fields (timeBinding / metric / …) authored through the SAME generic Inspector
//  that renders every other element. `id` is NOT in the schema — it is the
//  perspective's stable identity (the array key, shown read-only in the pane),
//  immutable through the Inspector exactly as `type`/`key` are for ParamDefs.
//  `when` / `available` are NOT here either — they are VisibilityExpr trees authored
//  by the recursive VisibilityBuilder (the escape-only override), not scalar fields.
//
//  The scope fields come from perspectiveScopeSchema() — the union of every
//  registered scope-key's PropSchema, re-prefixed to `scope.*` (the Law-8 / OCP
//  seam: a new scope door auto-surfaces). label/icon are grouped under "Identity";
//  the scope fields under "Scope" — the accordion the pane renders.
//
import type { PropSchema, PropField, PropertyGroup } from '@statdash/react/engine'
import type { SchemaSource } from '../../inspector/schemaSource'
import { perspectiveScopeSchema } from './perspectiveScopeSchemaSource'

/** The PerspectiveDef identity fields (label · icon) — bilingual label + icon-key picker. */
const IDENTITY_FIELDS: PropField[] = [
  { field: 'label', type: 'LocaleString', label: { ka: 'სათაური', en: 'Label' }, required: true },
  { field: 'icon',  type: 'icon',         label: { ka: 'ხატულა',  en: 'Icon'  } },
]

/** The full PerspectiveDef PropSchema = identity fields + the registry-driven scope fields. */
export function perspectiveDefSchema(): PropSchema {
  return [...IDENTITY_FIELDS, ...perspectiveScopeSchema()]
}

/** Accordion grouping: Identity (label/icon) then Scope (the registered scope-key fields). */
export function perspectiveDefGroups(): PropertyGroup[] {
  const scopeFields = perspectiveScopeSchema().map((f) => f.field)
  return [
    { label: { ka: 'იდენტობა', en: 'Identity' }, fields: ['label', 'icon'] },
    { label: { ka: 'სკოპი',    en: 'Scope'    }, fields: scopeFields },
  ]
}

export const perspectiveDefSchemaSource: SchemaSource = {
  getSchema: () => perspectiveDefSchema(),
  getGroups: () => perspectiveDefGroups(),
}
