// ── generatePageConfigSchema — the whole-config JSON Schema (ADR §7.7) ──────
//
//  The document-level expression of "config is the contract" (Law 4, P-2).
//  Vega-Lite ships vega-lite-schema.json; Grafana a dashboard schema; this is
//  ours. It is GENERATED from describeApp() (the SSOT registry manifest) — no
//  hand-maintained parallel truth — and emitted as a build artifact that
//  apps/api serves at GET /api/schema/page-config (see scripts/emit-…).
//
//  Composition (all derived from the manifest + the registered registries):
//    - per-node PropSchemas → $defs/node_<type>__<variant> object subschemas,
//      each pinning `type` to a const and allowing the NodeBase fields
//      (id/variant/data/view/children) — reuses propSchemaToSubSchema (the
//      existing bridge, NOT a fork).
//    - a `oneOf` over every node $def, discriminated by `type`.
//    - the DataSpec union (manifest.specTypes) → $defs/DataSpec (a oneOf of
//      type-const branches; structural floor only — fields live in the engine).
//    - PageConfigBase fields (incl. `presentation` authored via
//      presentationPropSchema()) folded onto the page-root branches.
//    - document root = the three page-root node types & PageConfigBase.
//
//  Dialect: Draft-2020-12 at the document ROOT ($defs + $ref), upgraded from
//  the bridge's Draft-07; node-level subschemas stay $schema-less $defs members
//  (propSchemaToSubSchema) so the existing Draft-07 authoring bridge is intact.
//
//  App-agnostic: this module names NO concrete node type, spec type, or tenant
//  literal — it iterates whatever the passed manifest carries. A new registered
//  type appears as a new $def + oneOf branch automatically (OCP / F3).
//
//  JSON-serializable: JSON.parse(JSON.stringify(result)) deep-equals result.
//

import type { AppManifest } from './constructor'
import { describeApp }      from './constructor'
import {
  propSchemaToSubSchema,
  DRAFT_2020_12,
  type JsonSchemaProperty,
  type JsonSubSchema,
}                           from './propSchemaToJsonSchema'
import { presentationPropSchema } from './presentation'

// ── Page-root discriminant set ──────────────────────────────────────────────
//  Mirrors the engine's PAGE_ROOT_TYPES (validation/config.ts). These are the
//  closed structural fact "a page's root is one of these three" — the document
//  root's oneOf. Kept as a named constant (no magic strings at use sites).
export const PAGE_ROOT_TYPES = ['inner-page', 'tab-page', 'container-page'] as const

// ── Output document type (Draft-2020-12) ────────────────────────────────────

/** A `oneOf` of `$ref` pointers (the AnyNode / DataSpec union shape). */
interface OneOfRefs { oneOf: Array<{ $ref: string } | JsonSchemaProperty> }

/** A Draft-2020-12 whole-config JSON Schema document. */
export interface PageConfigSchema {
  $schema:     typeof DRAFT_2020_12
  $id:         string
  title:       string
  description: string
  $defs:       Record<string, JsonSubSchema | OneOfRefs>
  oneOf:       Array<{ $ref: string }>
}

// ── Naming — stable, collision-free $defs keys (no magic strings) ────────────

/** `$defs` key for a node type+variant subschema. */
function nodeDefKey(type: string, variant: string): string {
  return `node_${type}__${variant}`
}

/** `$ref` pointer to a node `$def`. */
function nodeRef(type: string, variant: string): string {
  return `#/$defs/${nodeDefKey(type, variant)}`
}

// ── generatePageConfigSchema ────────────────────────────────────────────────

/**
 * Compose the whole-config JSON Schema from the registry manifest.
 *
 * @param manifest - defaults to describeApp(); pass an explicit manifest in
 *                   tests to pin a known registry state.
 * @returns A Draft-2020-12 JSON Schema document. JSON-serializable.
 */
export function generatePageConfigSchema(
  manifest: AppManifest = describeApp(),
): PageConfigSchema {
  const $defs: PageConfigSchema['$defs'] = {}

  // ── DataSpec union ($defs/DataSpec) — from manifest.specTypes ─────────────
  //  Structural floor only: each branch pins `data.type` to a registered spec
  //  type const. Per-field validation is engine-tier (validateDataSpec); the
  //  document schema asserts the discriminant is a known spec type.
  $defs.DataSpec = {
    oneOf: Object.keys(manifest.specTypes).map(specType => ({
      type: 'object' as const,
      properties: { type: { const: specType } },
      required: ['type'],
    })),
  }

  // ── PageConfigBase shared fields ($defs fragment, merged into page roots) ──
  const pageBaseProps = buildPageBaseProperties()

  // ── Per-node subschemas + the node oneOf ──────────────────────────────────
  //  One $def per palette entry (type+variant). Page-root entries additionally
  //  carry the PageConfigBase fields; every node allows the structural
  //  NodeBase fields (id/variant/data/view/children).
  const nodeRefs: Array<{ $ref: string }> = []
  for (const { type, variant } of manifest.palette) {
    const v = variant || 'default'
    const propSchema = manifest.propertySchemas[`${type}:${v}`] ?? null
    const isPageRoot = (PAGE_ROOT_TYPES as readonly string[]).includes(type)

    $defs[nodeDefKey(type, v)] = buildNodeDef(type, propSchema, isPageRoot ? pageBaseProps : undefined)
    nodeRefs.push({ $ref: nodeRef(type, v) })
  }

  // ── $defs/AnyNode — the shared "any registered node" union ─────────────────
  //  `children` items reference this single union, so adding a node type extends
  //  every container's accepted children with zero per-node edits (OCP).
  $defs.AnyNode = { oneOf: nodeRefs }

  // ── Document root oneOf — the page-root branches only ─────────────────────
  //  The whole-config root MUST be a page-root node. Non-root node types are
  //  reachable via `children` ($ref into the same $defs), not as a document root.
  const rootRefs = manifest.palette
    .filter(p => (PAGE_ROOT_TYPES as readonly string[]).includes(p.type))
    .map(p => ({ $ref: nodeRef(p.type, p.variant || 'default') }))

  return {
    $schema:     DRAFT_2020_12,
    $id:         'https://statdash.dev/schema/page-config.schema.json',
    title:       'StatDash Page Config',
    description:
      'The whole-config wire contract for a StatDash page (NodePageConfig). ' +
      'Generated from describeApp() — the registry manifest is the SSOT.',
    $defs,
    oneOf: rootRefs.length > 0 ? rootRefs : nodeRefs,
  }
}

// ── buildNodeDef — one node type+variant subschema ──────────────────────────

function buildNodeDef(
  type: string,
  propSchema: AppManifest['propertySchemas'][string] | null,
  pageBaseProps: Record<string, JsonSchemaProperty> | undefined,
): JsonSubSchema {
  // Authored props come from the PropSchema via the existing bridge (no fork).
  const sub = propSchemaToSubSchema(propSchema)

  // STRUCTURAL FLOOR ONLY (ADR §7.2): the document schema must NOT enforce
  // PropSchema-`required` (e.g. a section's authored `title`). Those are
  // AUTHORING requirements (app-tier, enforced by the inspector / node validate
  // hooks), not the wire-structural floor. A stored config that omits an
  // authored field is still a STRUCTURALLY valid page. Drop the per-field
  // requireds; the only structural requirements are `type` (+ page-root id/children).
  sub.required = []

  // Pin the discriminant: `type` is a const for this branch.
  sub.properties.type = { const: type }
  sub.required.push('type')

  // Structural NodeBase fields every node may carry.
  sub.properties.id       = { type: 'string', description: 'Node id' }
  sub.properties.variant  = { type: 'string', description: 'Registry variant' }
  sub.properties.data     = { $ref: '#/$defs/DataSpec' }
  sub.properties.view     = { type: 'object', description: 'ViewParams' }
  sub.properties.children = {
    type: 'array',
    description: 'Child nodes',
    items: { $ref: '#/$defs/AnyNode' },
  }

  // Page roots carry the PageConfigBase fields.
  if (pageBaseProps) {
    Object.assign(sub.properties, pageBaseProps)
    if (!sub.required.includes('id')) sub.required.push('id')
    if (!sub.required.includes('children')) sub.required.push('children')
  }

  // A node config may legitimately carry registry-driven fields we do not
  // enumerate field-by-field at the document level (rich semantics are
  // app-tier). Keep the document floor permissive on extra keys.
  sub.additionalProperties = true

  return sub
}

// ── buildPageBaseProperties — PageConfigBase document fields ─────────────────
//  Structural-floor properties for the page-level base. `presentation` is
//  authored via presentationPropSchema() (the union of registered projectors'
//  schema()), so a new projector's field appears automatically (OCP / Law 1).
function buildPageBaseProperties(): Record<string, JsonSchemaProperty> {
  const presentationSub = propSchemaToSubSchema(presentationPropSchema())
  return {
    id:            { type: 'string', description: 'Page id (required)' },
    schemaVersion: { type: 'integer', description: 'Page schema version' },
    frame:         { type: 'string', description: 'Layout geometry frame' },
    chrome:        { type: 'object', description: 'Per-page chrome slot overrides' },
    path:          { type: 'string', description: 'Page path / permalink segment' },
    color:         { type: 'string', description: 'Deprecated — use presentation.color' },
    presentation:  { type: 'object', properties: presentationSub.properties, additionalProperties: true },
    filterSchema:  { type: 'object', description: 'Declarative filter schema' },
    vars:          { type: 'object', description: 'Node-scoped derived vars' },
    modeOrder:     { type: 'array', description: 'View-mode ordering', items: { type: 'string' } },
  }
}
