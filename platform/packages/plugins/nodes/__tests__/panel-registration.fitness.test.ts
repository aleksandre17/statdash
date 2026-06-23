// @vitest-environment node
//
// ── panel-registration.fitness.test.ts — no-silent-drop invariant ─────────────
//
//  Guards the gap surfaced by the 2nd-tenant capstone: a panel can exist on disk
//  (panels/<name>/default/meta.ts) yet be MISSING from the registration barrels.
//  When that happens it never reaches registerSlice() → nodeRegistry.get(type) is
//  undefined → the node renders NOTHING, silently. (Concretely: `text` and
//  `gauge` were on disk but absent from panels/index.ts, so the runner's
//  emptyManifest() offline page — built from a `text` node — rendered empty.)
//
//  Invariant: EVERY panel directory under packages/plugins/panels/* that ships a
//  `default/meta.ts` MUST be wired into all three registration faces:
//    1. panels/index.ts  — the runtime barrel setupRegistrations.ts spreads into
//       registerSlice() (this is the one that populates nodeRegistry).
//    2. registry.ts       — the full runtime registry (renderer + react hooks).
//    3. catalog.ts        — the META-only palette face the Constructor reads.
//
//  This is a STRUCTURAL fitness: it reads the barrel SOURCE as text and the disk
//  layout. It deliberately does NOT import the panels barrel at runtime — that
//  barrel re-exports Shell components (React/apexcharts/leaflet) which are not
//  resolvable in the node test environment, and importing it would also defeat
//  the purpose (we want to catch a missing export, not crash on a present one).
//
//  Lives in engine/plugins — the only layer permitted to know plugin layout,
//  alongside the C0 schema-completeness fitness.
//

import { describe, it, expect } from 'vitest'
import { readdirSync, existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here        = dirname(fileURLToPath(import.meta.url))   // .../plugins/nodes/__tests__
const pluginsRoot = join(here, '..', '..')                    // .../plugins
const panelsDir   = join(pluginsRoot, 'panels')

// ── Discover every panel directory that ships a default/meta.ts ───────────────
//
//  A directory is a "panel" iff it carries default/meta.ts (the registration
//  contract: META is what registerSlice() routes on). Directories without one
//  are not registrable panels and are out of scope.
//
function discoverPanelDirs(): string[] {
  return readdirSync(panelsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(name => existsSync(join(panelsDir, name, 'default', 'meta.ts')))
    .sort()
}

const PANEL_DIRS = discoverPanelDirs()

const barrelSrc   = readFileSync(join(panelsDir, 'index.ts'),       'utf8')
const registrySrc = readFileSync(join(pluginsRoot, 'registry.ts'),  'utf8')
const catalogSrc  = readFileSync(join(pluginsRoot, 'catalog.ts'),   'utf8')

/** Does `src` re-export the panel dir `name` (matches `from './<name>'` or `'./panels/<name>'`)? */
function exportsPanel(src: string, name: string): boolean {
  // matches:  export * as foo from './text'   |   export { META as foo } from './panels/text'
  const re = new RegExp(`from\\s+['"]\\.(?:/panels)?/${name}['"]`)
  return re.test(src)
}

describe('panel-registration fitness — no silent-drop gap', () => {

  it('discovers the on-disk panels (sanity: corpus is non-empty)', () => {
    // If this ever empties, the discovery glob broke — fail loudly rather than
    // vacuously passing the assertions below.
    expect(PANEL_DIRS.length).toBeGreaterThan(0)
    expect(PANEL_DIRS).toContain('text')
    expect(PANEL_DIRS).toContain('gauge')
  })

  it('every on-disk panel is exported from the panels barrel (panels/index.ts)', () => {
    // panels/index.ts is the barrel setupRegistrations.ts spreads into
    // registerSlice() — a missing entry here is the exact silent-drop that left
    // nodeRegistry.get(type) undefined.
    const missing = PANEL_DIRS.filter(name => !exportsPanel(barrelSrc, name))
    expect(missing, `panels missing from panels/index.ts: ${missing.join(', ')}`).toEqual([])
  })

  it('every on-disk panel is exported from the runtime registry (registry.ts)', () => {
    const missing = PANEL_DIRS.filter(name => !exportsPanel(registrySrc, name))
    expect(missing, `panels missing from registry.ts: ${missing.join(', ')}`).toEqual([])
  })

  it('every on-disk panel is exported from the palette catalog (catalog.ts)', () => {
    const missing = PANEL_DIRS.filter(name => !exportsPanel(catalogSrc, name))
    expect(missing, `panels missing from catalog.ts: ${missing.join(', ')}`).toEqual([])
  })

})
