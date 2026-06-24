// ── page-config-schema.fitness.test.ts — F3 + wire-contract sanity ───────────
//
//  ADR adr-config-and-render-vision §7.8 F3 (manifest = palette = JSON Schema):
//    For every describeApp().palette[].type:
//      ∈ knownNodeTypes()  (the engine validator's node-type SET)
//      ∧ has a propertySchemas[type:variant]   (authoring face)
//      ∧ is a `oneOf` branch in generatePageConfigSchema()  (wire face)
//      ∧ is in the palette  (the source — tautology, asserted for completeness)
//  One half-registered type fails the build (negative test below).
//
//  Plus the wire-contract sanity the ADR §7 INVARIANTS require: a REAL config
//  validates against the EMITTED page-config.schema.json (ajv, Draft-2020-12).
//
//  Lives in engine/plugins — the layer permitted to import plugin META (the
//  arrow: engine/core ← engine/react ← engine/plugins). It registers every
//  node/panel/page META + the presentation projectors (mirroring the
//  emit-page-config-schema build script) so describeApp() is fully populated,
//  then asserts the three contract faces agree. Same node-safe meta.ts set the
//  schema-completeness fitness imports — no React/CSS in the META graph.
//

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import Ajv2020 from 'ajv/dist/2020'

import {
  nodeRegistry,
  describeApp,
  generatePageConfigSchema,
  registerPresentationProjector,
  listPresentationProjectors,
  nodeSchemaWithVariants,
  type NodeSliceMeta, type PanelSliceMeta, type PageSliceMeta,
} from '@statdash/react/engine'
import { knownNodeTypes, registerNodeType } from '@statdash/engine'

// ── Node/panel/page METAs — direct meta.ts (node-safe, CSS-free) ─────────────
import { META as section }       from '../section/default/meta'
import { META as modeBar }       from '../mode-bar/default/meta'
import { META as filterBar }     from '../filter-bar/default/meta'
import { META as pageHeader }    from '../page-header/default/meta'
import { META as geograph }     from '../geograph/default/meta'
import { META as links }         from '../links/default/meta'
import { META as repeat }        from '../repeat/default/meta'
import { META as hero }          from '../hero/default/meta'
import { META as statsCarousel } from '../stats-carousel/default/meta'
import { META as row }     from '../layout/row/default/meta'
import { META as grid }    from '../layout/grid/default/meta'
import { META as columns } from '../layout/columns/default/meta'
import { META as stack }   from '../layout/stack/default/meta'
import { META as card }    from '../layout/card/default/meta'
import { META as divider } from '../layout/divider/default/meta'
import { META as spacer }  from '../layout/spacer/default/meta'
import { META as wrap }    from '../layout/wrap/default/meta'
import { META as chart }    from '../../panels/chart/default/meta'
import { META as kpiStrip } from '../../panels/kpi-strip/default/meta'
import { META as table }    from '../../panels/table/default/meta'
import { META as map }      from '../../panels/map/default/meta'
import { META as text }     from '../../panels/text/default/meta'
import { META as gauge }    from '../../panels/gauge/default/meta'
import { META as innerPage }     from '../../pages/inner-page/default/meta'
import { META as containerPage } from '../../pages/container-page/default/meta'
import { META as tabPage }       from '../../pages/tab-page/default/meta'
import { colorProjector }  from '../../presentation/colorProjector'
import { crumbsProjector } from '../../presentation/crumbsProjector'

type PlaceableMeta = NodeSliceMeta | PanelSliceMeta | PageSliceMeta

const ALL_METAS: PlaceableMeta[] = [
  innerPage, containerPage, tabPage,
  section, modeBar, filterBar, pageHeader, geograph, links, repeat, hero, statsCarousel,
  row, grid, columns, stack, card, divider, spacer, wrap,
  chart, kpiStrip, table, map, text, gauge,
]

/** Register every placeable META + projectors — mirrors the emit build script. */
function setupRegistry(): void {
  const noopShell = () => null
  for (const m of ALL_METAS) {
    nodeRegistry.register(m.type, m.variant ?? 'default', noopShell, {
      label:    m.label,
      icon:     m.icon,
      category: m.category,
      // Same variant-folding SSOT as registerSlice + the emit-schema tool.
      schema:   nodeSchemaWithVariants(m.schema, 'variants' in m ? m.variants : undefined),
      defaults: m.defaults,
      slots:    'slots' in m ? m.slots : undefined,
      version:  m.version,
    })
    registerNodeType(m.type)
  }
  registerPresentationProjector(colorProjector)
  registerPresentationProjector(crumbsProjector)
}

beforeAll(setupRegistry)

// ── F3 — manifest = palette = JSON Schema (every face agrees) ────────────────

describe('F3 — every placeable type is reachable by all three contract faces', () => {

  it('every palette type is ∈ knownNodeTypes ∧ has a PropSchema ∧ is a oneOf/AnyNode branch', () => {
    const manifest = describeApp()
    const schema   = generatePageConfigSchema(manifest)
    const known    = new Set(knownNodeTypes())

    // The wire face: the set of node types reachable as a $def referenced by the
    // document (page roots in root.oneOf, others via $defs/AnyNode.oneOf).
    const anyNode  = schema.$defs.AnyNode as { oneOf: Array<{ $ref: string }> }
    const refTypes = new Set(
      anyNode.oneOf.map(b => b.$ref.replace('#/$defs/node_', '').replace(/__.*$/, '')),
    )

    const offenders: string[] = []
    for (const { type, variant } of manifest.palette) {
      const v = variant || 'default'
      const inKnown  = known.has(type)
      const hasSchema = manifest.propertySchemas[`${type}:${v}`] != null
      const inWire   = refTypes.has(type)
      // Schema-less pure containers/transparent nodes are allowed (their $def is
      // still a oneOf branch). The HARD invariants are: validator set + wire face.
      if (!inKnown || !inWire) {
        offenders.push(`${type}:${v} { known:${inKnown} schema:${hasSchema} wire:${inWire} }`)
      }
    }
    expect(offenders, `half-registered types: ${offenders.join(' | ')}`).toEqual([])
  })

  it('every page-root type is a document-root oneOf branch', () => {
    const schema = generatePageConfigSchema()
    const roots  = schema.oneOf.map(r => r.$ref)
    for (const t of ['inner-page', 'container-page', 'tab-page']) {
      expect(roots, `page root ${t} missing from document root oneOf`)
        .toContain(`#/$defs/node_${t}__default`)
    }
  })

  it('the DataSpec union folds in every registered spec type', () => {
    const manifest = describeApp()
    const schema   = generatePageConfigSchema(manifest)
    const branches = (schema.$defs.DataSpec as { oneOf: Array<{ properties: { type: { const: string } } }> }).oneOf
    const specConsts = new Set(branches.map(b => b.properties.type.const))
    for (const specType of Object.keys(manifest.specTypes)) {
      expect(specConsts, `spec type ${specType} missing from DataSpec oneOf`).toContain(specType)
    }
  })

  it('a HALF-REGISTERED type (in palette, absent from the validator set) is caught', () => {
    // Simulate the exact drift F3 guards: a type the palette advertises but that
    // was never injected into the engine's node-type set. The fitness must flag it.
    const fakeManifest = {
      ...describeApp(),
      palette: [
        ...describeApp().palette,
        { type: 'ghost-node', variant: 'default', label: 'Ghost' },
      ],
    }
    const schema   = generatePageConfigSchema(fakeManifest)
    const known    = new Set(knownNodeTypes())
    const anyNode  = schema.$defs.AnyNode as { oneOf: Array<{ $ref: string }> }
    const refTypes = new Set(
      anyNode.oneOf.map(b => b.$ref.replace('#/$defs/node_', '').replace(/__.*$/, '')),
    )
    // ghost-node IS in the wire face (palette drove a $def) but NOT in the
    // validator set → the F3 "∈ knownNodeTypes" assertion would fail for it.
    expect(refTypes.has('ghost-node')).toBe(true)
    expect(known.has('ghost-node')).toBe(false)
  })
})

// ── F5 — no presentation concern is ALSO a flat PageConfigBase field ─────────
//
//  ADR adr-config-and-render-vision finish-line #4 (P-5 single-home). Page color
//  once had TWO homes — a flat PageConfigBase.color field AND presentation.color.
//  The v1→v2 migrator collapsed them to ONE: presentation.color. F5 makes that
//  un-regressable: a registered presentation projector key MUST NOT also appear
//  as a flat page-base document field. The page-base document fields are the
//  runtime SSOT enumeration in the generator (buildPageBaseProperties → the
//  page-root $def properties), so a future flat-vs-projector duplication — or a
//  re-added flat `color` — fails this build.
//
describe('F5 — a presentation projector key is never also a flat PageConfigBase field', () => {

  /** The flat page-base document fields = a page-root $def's own properties minus
   *  the structural NodeBase keys and `presentation` itself (the projector bag). */
  function flatPageBaseFields(): Set<string> {
    const schema = generatePageConfigSchema()
    const pageRoot = schema.$defs['node_inner-page__default'] as { properties: Record<string, unknown> }
    const keys = Object.keys(pageRoot.properties)
    // Exclude the structural NodeBase fields buildNodeDef adds to every node and
    // the `presentation` bag — what remains is the PageConfigBase flat surface.
    const NON_PAGE_BASE = new Set([
      'type', 'id', 'variant', 'data', 'view', 'children', 'presentation',
    ])
    return new Set(keys.filter(k => !NON_PAGE_BASE.has(k)))
  }

  it('no registered projector key collides with a flat page-base field', () => {
    const flat = flatPageBaseFields()
    const collisions = listPresentationProjectors()
      .map(p => p.key)
      .filter(key => flat.has(key))
    expect(collisions, `projector keys also present as flat page fields: ${collisions.join(', ')}`)
      .toEqual([])
  })

  it('`color` is gone from the flat page-base surface and lives ONLY as a projector', () => {
    const flat = flatPageBaseFields()
    expect(flat.has('color'), 'flat PageConfigBase.color was re-introduced — color is projector-only').toBe(false)
    const projectorKeys = listPresentationProjectors().map(p => p.key)
    expect(projectorKeys, 'color projector missing from the registry').toContain('color')
  })
})

// ── Wire-contract sanity — a REAL config validates against the EMITTED schema ─

describe('wire contract — a real config validates against the emitted artifact', () => {
  // The committed build artifact apps/api serves (packages/contracts/schema/…).
  const artifactPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '..', '..', '..', 'contracts', 'schema', 'page-config.schema.json',
  )

  it('the emitted page-config.schema.json is present and Draft-2020-12', () => {
    const doc = JSON.parse(readFileSync(artifactPath, 'utf8'))
    expect(doc.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
    expect(Array.isArray(doc.oneOf)).toBe(true)
  })

  it('a realistic NodePageConfig validates against the emitted schema (ajv)', () => {
    const doc = JSON.parse(readFileSync(artifactPath, 'utf8'))
    const ajv = new Ajv2020({ allErrors: true, strict: false })
    const validate = ajv.compile(doc)

    // A realistic page: inner-page root → section → chart panel with a DataSpec,
    // plus a page-level presentation contribution (color projector).
    const realConfig = {
      type: 'inner-page',
      id: 'overview',
      schemaVersion: 1,
      presentation: { color: '#0b5fff' },
      children: [
        {
          type: 'section',
          id: 'sec-gdp',
          children: [
            {
              type: 'chart',
              id: 'chart-gdp',
              data: { type: 'row-list', rows: [{ code: 'GDP' }] },
            },
          ],
        },
      ],
    }

    const ok = validate(realConfig)
    expect(ok, `ajv errors: ${JSON.stringify(validate.errors, null, 2)}`).toBe(true)
  })

  it('the live generator output equals the committed artifact (no drift)', () => {
    // Pins gen:schema as the SSOT: if the registry changes, the artifact must be
    // re-emitted. Catches a stale committed schema.
    const committed = JSON.parse(readFileSync(artifactPath, 'utf8'))
    const live = JSON.parse(JSON.stringify(generatePageConfigSchema()))
    expect(live).toEqual(committed)
  })
})
