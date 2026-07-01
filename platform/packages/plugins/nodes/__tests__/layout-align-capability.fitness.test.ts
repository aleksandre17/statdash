// @vitest-environment node
//
// ── FF-NO-DEAD-CAPABILITY — the `align` capability is wired end-to-end ─────────
//
//  DESIGN-responsive-composition.md §3.1 / P2: a `[data-x]` selector in the
//  layout CSS is a DEAD capability unless it is (a) an authored schema field and
//  (b) emitted by the container's shell. `align` was exactly that — CSS-only,
//  invisible to the Constructor. This fitness locks the three-way contract so it
//  can never silently drift back into a dead one:
//
//    schema field ‹align›  ↔  CSS `[data-align]` rule  ↔  shell emits data-align
//
//  Scope: the three layout CONTAINER primitives that own a cross-axis
//  (columns / grid / stack). If a fourth container grows a `[data-align]` rule it
//  must join this table (and thereby get a schema field + emitting shell).
//
import { describe, it, expect } from 'vitest'
import { readFileSync }         from 'node:fs'
import { fileURLToPath }        from 'node:url'
import { dirname, resolve }     from 'node:path'
import type { PropSchema }      from '@statdash/react/engine/slice-meta'

import { ColumnsSchema } from '../layout/columns/default/ColumnsNode'
import { GridSchema }    from '../layout/grid/default/GridNode'
import { StackSchema }   from '../layout/stack/default/StackNode'

const HERE       = dirname(fileURLToPath(import.meta.url))
const LAYOUT_DIR = resolve(HERE, '../layout')
const layoutCss  = readFileSync(resolve(LAYOUT_DIR, 'layout.css'), 'utf8')

// Each container primitive: its CSS class, its schema, its shell source.
const CONTAINERS = [
  { name: 'columns', cssClass: 'layout-columns', schema: ColumnsSchema, shell: 'columns/default/ColumnsShell.tsx' },
  { name: 'grid',    cssClass: 'layout-grid',    schema: GridSchema,    shell: 'grid/default/GridShell.tsx' },
  { name: 'stack',   cssClass: 'layout-stack',   schema: StackSchema,   shell: 'stack/default/StackShell.tsx' },
] as const

function alignField(schema: PropSchema) {
  return schema.find(f => f.field === 'align')
}

describe('FF-NO-DEAD-CAPABILITY — layout `align`', () => {

  it.each(CONTAINERS)('$name: schema declares an `align` field with an option set', ({ schema }) => {
    const field = alignField(schema)
    expect(field, '`align` must be an authored schema field').toBeDefined()
    // enum-authored so the Inspector renders a select, not a free string.
    expect(field?.options?.map(o => o.value).sort()).toEqual(['center', 'end', 'start', 'stretch'])
  })

  it.each(CONTAINERS)('$name: layout.css maps [data-align] on .$cssClass', ({ cssClass }) => {
    // At least the three non-default values must have a rule (stretch = CSS default).
    for (const v of ['start', 'center', 'end']) {
      const selector = new RegExp(`\\.${cssClass}\\[data-align="${v}"\\]`)
      expect(layoutCss, `.${cssClass}[data-align="${v}"] rule missing`).toMatch(selector)
    }
  })

  it.each(CONTAINERS)('$name: shell emits data-align via resolveAlign', ({ shell }) => {
    const src = readFileSync(resolve(LAYOUT_DIR, shell), 'utf8')
    expect(src, 'shell must resolve the align field').toMatch(/resolveAlign\(/)
    expect(src, 'shell must emit the data-align attribute').toMatch(/data-align=\{align\}/)
  })

  it('every [data-align] selector in layout.css belongs to a registered container', () => {
    // The inverse guard: no orphan [data-align] rule for a class outside the table.
    const classes = new Set<string>(CONTAINERS.map(c => c.cssClass))
    const orphans = [...layoutCss.matchAll(/\.([a-z-]+)\[data-align=/g)]
      .map(m => m[1])
      .filter(cls => !classes.has(cls))
    expect(orphans).toEqual([])
  })

})
