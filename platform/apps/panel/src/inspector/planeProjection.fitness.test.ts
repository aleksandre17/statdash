// ── FF-NO-UNPROJECTED-DECLARED-FIELD — the author never sees the system plane ─────
//
//  The machine half of the Authoring Canon's "projection with a plane" (root Law 11 ·
//  ADR-043). Every declared field / facet carries an audience; the Constructor projects
//  ONLY to the active lens. This gate asserts the invariant the exhausted owner judges
//  by eye on :3013: NO `system`-plane field (a derive-graph `vars`, a raw `dim→value`
//  coordinate, a derived breadcrumb spec) and NO non-author facet (the advanced
//  VISIBILITY facet is `steward`) renders on the AUTHOR plane.
//
//    • FIELD level  — `filterSchemaByPlanes` drops non-visible fields; the real
//      registered schemas (page root · kpi value) carry the `system` tag, so the
//      author projection excludes them (steward too — `system` is projected to no one).
//    • FACET level  — the VISIBILITY facet (`plane:'steward'`) yields NO dock section
//      under the author lens, and DOES under the steward lens (reachable, not deleted).
//
import { describe, it, expect, beforeAll } from 'vitest'
import { nodeRegistry, facetRegistry } from '@statdash/react/engine'
import type { PropField, PropSchema, AudiencePlane } from '@statdash/react/engine'
import type { CanvasController } from '../studio/useCanvasController'
import type { Role } from '../studio/useRole'
import { dockSectionRegistry, type DockRenderCtx } from './sections/dockSection'
import { registerBuiltinDockSections } from './sections/builtins'
import { registerBuiltinFacets } from './facets/builtinFacets'
import { setupCanvasRegistry } from '../canvas/setupCanvasRegistry'
import { pageSchema } from '../features/page-config/pageSchemaSource'
import { planesForRole, isPlaneVisible, filterSchemaByPlanes } from './plane'

beforeAll(() => {
  setupCanvasRegistry()      // real plugin metas + presentation projectors (crumbs)
  registerBuiltinFacets()
  registerBuiltinDockSections()
})

const controller = (over: Partial<CanvasController>): CanvasController =>
  ({ selected: null, selectedBand: null, ...over } as unknown as CanvasController)

const elementCtx = (over: Partial<CanvasController>, role?: Role): DockRenderCtx =>
  ({ scope: 'element', locale: 'en', controller: controller(over), role } as DockRenderCtx)

/** Deep-find a field by dot-path leaf in a (possibly nested) schema, following itemSchema. */
const findField = (schema: PropSchema, name: string): PropField | undefined => {
  for (const f of schema) {
    if (f.field === name) return f
    if (f.itemSchema) {
      const nested = findField(f.itemSchema, name)
      if (nested) return nested
    }
  }
  return undefined
}

describe('FF-NO-UNPROJECTED-DECLARED-FIELD — the plane lens', () => {
  // ── the lens itself ────────────────────────────────────────────────────────────
  it('planesForRole: author sees {author} only; steward adds {steward}; system is in NEITHER', () => {
    const author  = planesForRole('author')
    const steward = planesForRole('steward')
    expect([...author]).toEqual(['author'])
    expect(steward.has('author')).toBe(true)
    expect(steward.has('steward')).toBe(true)
    // `system` is projected to NO ONE by default (root Law 11) — not even the steward lens.
    expect(author.has('system')).toBe(false)
    expect(steward.has('system')).toBe(false)
    // Undefined role ⇒ the safe author default.
    expect([...planesForRole(undefined)]).toEqual(['author'])
  })

  it('isPlaneVisible: an untagged field defaults to author-visible (unmigrated byte-identical)', () => {
    const author = planesForRole('author')
    expect(isPlaneVisible(undefined, author)).toBe(true)
    expect(isPlaneVisible('author', author)).toBe(true)
    expect(isPlaneVisible('steward', author)).toBe(false)
    expect(isPlaneVisible('system', author)).toBe(false)
    expect(isPlaneVisible('system', planesForRole('steward'))).toBe(false)
  })

  it('filterSchemaByPlanes drops non-visible fields per lens', () => {
    const schema: PropSchema = [
      { field: 'a', type: 'string', label: { en: 'A' } },                        // author (default)
      { field: 'b', type: 'string', label: { en: 'B' }, plane: 'author' },
      { field: 'c', type: 'string', label: { en: 'C' }, plane: 'steward' },
      { field: 'd', type: 'object', label: { en: 'D' }, plane: 'system' },
    ]
    const authorFields  = filterSchemaByPlanes(schema, planesForRole('author')).map((f) => f.field)
    const stewardFields = filterSchemaByPlanes(schema, planesForRole('steward')).map((f) => f.field)
    expect(authorFields).toEqual(['a', 'b'])              // no steward, no system
    expect(stewardFields).toEqual(['a', 'b', 'c'])        // steward, still no system
  })

  // ── FIELD level: the real leaking schemas (the disease in screenshot 04) ─────────
  it('the page root schema tags `vars` and `presentation.crumbs` as system — hidden from author AND steward', () => {
    const schema = pageSchema()
    const vars   = findField(schema, 'vars')
    const crumbs = schema.find((f) => f.field === 'presentation.crumbs')
    expect(vars?.plane).toBe('system')
    expect(crumbs?.plane, 'crumbs projector must tag plane:system').toBe('system')

    for (const role of ['author', 'steward'] as const) {
      const visible = filterSchemaByPlanes(schema, planesForRole(role)).map((f) => f.field)
      expect(visible, `${role} must not see vars`).not.toContain('vars')
      expect(visible, `${role} must not see the derived breadcrumbs`).not.toContain('presentation.crumbs')
    }
  })

  it('the kpi value schema tags the raw `dim→value` coordinate (`filter`) as system — hidden from the author', () => {
    // The CONSUMER proof: navigate the REAL registered kpi-strip schema to the value's
    // coordinate field and assert it is plumbing, then that the author filter drops it.
    const kpiSchema = nodeRegistry.getSchema('kpi-strip') ?? []
    const coordinate = findField(kpiSchema, 'filter')
    expect(coordinate?.plane, 'kpi value coordinate must be plane:system').toBe('system')
    expect(isPlaneVisible(coordinate?.plane, planesForRole('author'))).toBe(false)
  })

  it('the invariant sweep — NO system-plane field survives the author projection of any real node schema', () => {
    const collectSystem = (schema: PropSchema): string[] => {
      const out: string[] = []
      for (const f of schema) {
        if (f.plane === 'system') out.push(f.field)
        if (f.itemSchema) out.push(...collectSystem(f.itemSchema))
      }
      return out
    }
    const author = planesForRole('author')
    for (const type of ['kpi-strip', 'featured-slider', 'chart', 'section']) {
      const schema = nodeRegistry.getSchema(type) ?? []
      const systemFields = collectSystem(schema)
      const authorVisible = filterSchemaByPlanes(schema, author)
      for (const sysField of systemFields) {
        expect(authorVisible.some((f) => f.field === sysField), `${type}.${sysField} leaked to author`).toBe(false)
      }
    }
  })

  // ── FACET level: the advanced VISIBILITY facet is steward-plane ──────────────────
  it('the VISIBILITY facet declares plane:steward', () => {
    const vis = facetRegistry.list().find((f) => f.id === 'visibility')!
    expect(vis.plane).toBe('steward')
  })

  it('a whole node gets element.facet.visibility under the STEWARD lens, NOT under the author lens', () => {
    const chart = { id: 'c1', type: 'chart', props: {} }
    const authorIds  = dockSectionRegistry.list(elementCtx({ selected: chart as never }, 'author')).map((s) => s.id)
    const stewardIds = dockSectionRegistry.list(elementCtx({ selected: chart as never }, 'steward')).map((s) => s.id)
    // Author dock: the advanced show-when facet is hidden (plumbing-free REFINE surface).
    expect(authorIds).not.toContain('element.facet.visibility')
    // Steward lens: it is reachable (not deleted — just projected to its audience).
    expect(stewardIds).toContain('element.facet.visibility')
    // The author-plane facets (STYLE) show under BOTH lenses — only the steward facet is gated.
    expect(authorIds).toContain('element.facet.style')
    expect(stewardIds).toContain('element.facet.style')
  })

  it('an absent role defaults to the author lens — the safe default hides the steward facet', () => {
    const chart = { id: 'c1', type: 'chart', props: {} }
    const ids = dockSectionRegistry.list(elementCtx({ selected: chart as never })).map((s) => s.id)
    expect(ids).not.toContain('element.facet.visibility')
  })
})

// A no-op read so the AudiencePlane import type is exercised (keeps the type surface honest).
const _planeTypeProbe: AudiencePlane = 'author'
void _planeTypeProbe
