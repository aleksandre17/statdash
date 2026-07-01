// ── Fitness function — FF-UNIFORM-SECTION-AUTHORING ──────────────────────────
//
// The owner's #1 section complaint ("არაერთგვაროვანი" — non-uniform handwriting):
// sections were authored TWO different ways across pages. `gdp` composed every
// section group through a `columns` layout node (side-by-side pairs AND single
// sections, count:1); `accounts` and `regional` dumped some sections as DIRECT
// children of the page body — the bespoke, page-special-cased handwriting.
//
// THE CANONICAL FORM (DESIGN-responsive-composition.md §3 — a grammar of composition):
//   Every `section` (and every section-like `geograph`, and every section-emitting
//   `repeat`) is composed THROUGH a layout container. The layout VARIES by genuine
//   content need — a pair uses `columns` count:2, a single uses `columns` count:1 —
//   but the FORM is uniform: a section is NEVER a direct child of the page body, and
//   no page special-cases section placement with a bespoke wrapper.
//
// THE INVARIANT (the one-handwriting law, structural, no registry import needed):
//   For every inner-page, every `section`/`geograph` node in its config tree has at
//   least one ANCESTOR whose type is a layout container (columns | grid | stack).
//   This single check subsumes both failure shapes:
//     • a section as a DIRECT child of `config.children` has no such ancestor → fail;
//     • a section produced by a top-level `repeat` (a control node, NOT a layout
//       container) has only the repeat as ancestor → fail unless the repeat is
//       itself nested under a layout container.
//
// LAYOUT-CONTAINER SET (SSOT = the `nav-transparent` cap roster in the node registry:
//   columns/grid/stack — packages/plugins/nodes/layout/**/meta.ts). Mirrored here as
//   a literal because this fitness test lives in apps/api, which the dependency arrow
//   forbids from importing packages/react (the registry). A new layout container that
//   may wrap sections in config is added to BOTH places — the roster is small and the
//   drift is itself caught by the nav-transparent cap test in packages/plugins.
//
// Needs no DATABASE_URL: reads the committed artifact off disk and asserts pure
// structural invariants — sibling of geostat-provisioning.fitness.test.ts.

import { describe, it, expect, beforeAll } from 'vitest'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const ARTIFACT_PATH = resolve(here, '../../provisioning/geostat.provisioning.json')

// The node types that COMPOSE structure (descend-for-nav containers). SSOT: the
// `nav-transparent` cap roster — keep in sync with packages/plugins/nodes/layout.
const LAYOUT_CONTAINERS = new Set(['columns', 'grid', 'stack'])
// Nodes that ARE a section for authoring/nav purposes (the `nav-contributor` cap).
const SECTION_LIKE = new Set(['section', 'geograph'])

interface NodeLike { type?: unknown; id?: unknown; children?: unknown }
interface PageConfig { id?: unknown; type?: unknown; children?: unknown }
interface PageEntry { config: PageConfig }
interface Artifact { pages: PageEntry[] }

const asNode = (v: unknown): NodeLike => (v && typeof v === 'object' ? (v as NodeLike) : {})
const childrenOf = (n: NodeLike): NodeLike[] =>
  Array.isArray(n.children) ? n.children.map(asNode) : []

describe('FF-UNIFORM-SECTION-AUTHORING — every section composed through a layout node', () => {
  let artifact: Artifact

  beforeAll(async () => {
    artifact = JSON.parse(await readFile(ARTIFACT_PATH, 'utf8')) as Artifact
  })

  const innerPages = () =>
    artifact.pages.filter((p) => p.config?.type === 'inner-page')

  // Collect every section-like node paired with whether it has a layout ancestor.
  function scanSections(
    node: NodeLike,
    ancestorTypes: string[],
    out: { id: string; hasLayoutAncestor: boolean }[],
  ): void {
    const t = typeof node.type === 'string' ? node.type : undefined
    if (t && SECTION_LIKE.has(t)) {
      out.push({
        id: typeof node.id === 'string' ? node.id : t,
        hasLayoutAncestor: ancestorTypes.some((a) => LAYOUT_CONTAINERS.has(a)),
      })
    }
    const nextAncestors = t ? [...ancestorTypes, t] : ancestorTypes
    for (const child of childrenOf(node)) scanSections(child, nextAncestors, out)
  }

  it('THE INVARIANT — no section/geograph lacks a layout-container ancestor', () => {
    const offenders: string[] = []
    let total = 0
    for (const page of innerPages()) {
      const found: { id: string; hasLayoutAncestor: boolean }[] = []
      for (const child of childrenOf(asNode(page.config))) scanSections(child, [], found)
      total += found.length
      for (const s of found) if (!s.hasLayoutAncestor) offenders.push(`${String(page.config.id)}:${s.id}`)
    }
    // Non-vacuous: the artifact really does carry sections (else the guard is a no-op).
    expect(total).toBeGreaterThan(0)
    expect(offenders, 'sections must be nested under a columns/grid/stack layout node, never authored as a direct child of the page body').toEqual([])
  })

  it('no inner-page authors a section/geograph/repeat as a DIRECT child of the page body', () => {
    const bad: string[] = []
    for (const page of innerPages()) {
      for (const child of childrenOf(asNode(page.config))) {
        const t = typeof child.type === 'string' ? child.type : ''
        if (SECTION_LIKE.has(t) || t === 'repeat') {
          bad.push(`${String(page.config.id)}:${typeof child.id === 'string' ? child.id : t}`)
        }
      }
    }
    expect(bad, 'section-bearing nodes at the page root must be wrapped in a layout container (one handwriting)').toEqual([])
  })

  it('every layout container at the page root carries the group perspective gate (not the inner section)', () => {
    // The canonical form hoists the section-group `visibleWhen` onto the columns
    // wrapper; the wrapped single section must NOT also carry a perspective gate
    // (that would be the old redundant, per-section special-casing).
    const redundant: string[] = []
    for (const page of innerPages()) {
      for (const child of childrenOf(asNode(page.config))) {
        if (typeof child.type === 'string' && LAYOUT_CONTAINERS.has(child.type)) {
          const kids = childrenOf(child)
          // single-section wrappers only — a pair legitimately gates children by other params
          if (kids.length !== 1) continue
          const inner = kids[0]
          const view = asNode((inner as NodeLike & { view?: unknown }).view as unknown)
          const vw = (view as { visibleWhen?: unknown }).visibleWhen
          if (vw && typeof vw === 'object' && (vw as { op?: unknown }).op === 'perspective-is') {
            redundant.push(`${String(page.config.id)}:${typeof inner.id === 'string' ? inner.id : String(inner.type)}`)
          }
        }
      }
    }
    expect(redundant, 'the perspective gate belongs on the columns wrapper, not duplicated on the inner section').toEqual([])
  })
})
