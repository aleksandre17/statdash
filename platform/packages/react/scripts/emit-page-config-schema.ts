// ── emit-page-config-schema — generate the wire-contract artifact (ADR §7.7) ─
//
//  BUILD TOOLING (not shipped). Populates the FULL plugin registry, runs
//  generatePageConfigSchema(), and writes the artifact to
//  packages/contracts/schema/page-config.schema.json — the cross-arrow-legal
//  home apps/api reads (a GENERATED DATA file, not code; contracts' zero-dep
//  CODE rule is unaffected). Run via `pnpm gen:schema`.
//
//  Why this lives in packages/react/scripts (not src): it must reach the plugin
//  META catalog + projectors to build describeApp(), which the shipped library
//  (src/**) may not import (the arrow). scripts/ is excluded from the published
//  surface (react `files: ["dist"]`) and from the react import-boundary lint —
//  exactly as apps/api/scripts import seed data. The shipped renderer stays
//  app-agnostic; only this build tool reaches across.
//
//  Imports are DIRECT FILE paths (not the package barrels): the plugin meta.ts
//  files and projector files are pure TypeScript with only `import type` from
//  react, so a plain `tsx` run resolves them WITHOUT pulling the React/CSS
//  runtime graph (the barrels import .css, which Node's loader cannot handle).
//  This is the same node-safe meta.ts set the schema-completeness fitness uses.
//

import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { nodeRegistry } from '../src/engine/register-all'
import { generatePageConfigSchema } from '../src/engine/generatePageConfigSchema'
import { registerPresentationProjector } from '../src/engine/presentation/presentationRegistry'
import { registerNodeType } from '@statdash/engine'
import type { NodeSliceMeta, PanelSliceMeta, PageSliceMeta } from '../src/engine/slice-meta'

// ── Node/panel/page METAs — direct meta.ts imports (node-safe, CSS-free) ─────
import { META as section }       from '../../plugins/nodes/section/default/meta'
import { META as modeBar }       from '../../plugins/nodes/mode-bar/default/meta'
import { META as filterBar }     from '../../plugins/nodes/filter-bar/default/meta'
import { META as pageHeader }    from '../../plugins/nodes/page-header/default/meta'
import { META as geograph }      from '../../plugins/nodes/geograph/default/meta'
import { META as links }         from '../../plugins/nodes/links/default/meta'
import { META as repeat }        from '../../plugins/nodes/repeat/default/meta'
import { META as hero }          from '../../plugins/nodes/hero/default/meta'
import { META as statsCarousel } from '../../plugins/nodes/stats-carousel/default/meta'

import { META as row }     from '../../plugins/nodes/layout/row/default/meta'
import { META as grid }    from '../../plugins/nodes/layout/grid/default/meta'
import { META as columns } from '../../plugins/nodes/layout/columns/default/meta'
import { META as stack }   from '../../plugins/nodes/layout/stack/default/meta'
import { META as card }    from '../../plugins/nodes/layout/card/default/meta'
import { META as divider } from '../../plugins/nodes/layout/divider/default/meta'
import { META as spacer }  from '../../plugins/nodes/layout/spacer/default/meta'
import { META as wrap }    from '../../plugins/nodes/layout/wrap/default/meta'

import { META as chart }    from '../../plugins/panels/chart/default/meta'
import { META as kpiStrip } from '../../plugins/panels/kpi-strip/default/meta'
import { META as table }    from '../../plugins/panels/table/default/meta'
import { META as map }      from '../../plugins/panels/map/default/meta'
import { META as text }     from '../../plugins/panels/text/default/meta'
import { META as gauge }    from '../../plugins/panels/gauge/default/meta'

import { META as innerPage }     from '../../plugins/pages/inner-page/default/meta'
import { META as containerPage } from '../../plugins/pages/container-page/default/meta'
import { META as tabPage }       from '../../plugins/pages/tab-page/default/meta'

// ── Presentation projectors — direct file imports (type-only react deps) ─────
import { colorProjector }  from '../../plugins/presentation/colorProjector'
import { crumbsProjector } from '../../plugins/presentation/crumbsProjector'

type PlaceableMeta = NodeSliceMeta | PanelSliceMeta | PageSliceMeta

const ALL_METAS: PlaceableMeta[] = [
  innerPage, containerPage, tabPage,
  section, modeBar, filterBar, pageHeader, geograph, links, repeat, hero, statsCarousel,
  row, grid, columns, stack, card, divider, spacer, wrap,
  chart, kpiStrip, table, map, text, gauge,
]

// ── setupRegistrations() — populate the registry the generator reads ─────────
//  A no-op-Shell registration: the generator needs META (palette + schema), not
//  the renderer. registerNodeType mirrors what registerSlice does at runtime so
//  the engine's known-type set is populated. registerPresentationProjector wires
//  the page `presentation` schema (color/crumbs) the same way app boot does.
function setupRegistrations(): void {
  const noopShell = () => null
  for (const m of ALL_METAS) {
    nodeRegistry.register(m.type, m.variant ?? 'default', noopShell, {
      label:    m.label,
      icon:     m.icon,
      category: m.category,
      schema:   m.schema,
      defaults: m.defaults,
      slots:    'slots' in m ? m.slots : undefined,
      version:  m.version,
    })
    registerNodeType(m.type)
  }
  registerPresentationProjector(colorProjector)
  registerPresentationProjector(crumbsProjector)
}

// ── Emit ─────────────────────────────────────────────────────────────────────

function main(): void {
  setupRegistrations()
  const schema = generatePageConfigSchema()

  const here = dirname(fileURLToPath(import.meta.url))            // packages/react/scripts
  const outDir = join(here, '..', '..', 'contracts', 'schema')   // packages/contracts/schema
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, 'page-config.schema.json')

  writeFileSync(outPath, JSON.stringify(schema, null, 2) + '\n', 'utf8')
  // eslint-disable-next-line no-console
  console.log(
    `[gen:schema] wrote ${outPath} — ` +
    `${schema.oneOf.length} page-root branch(es), ${Object.keys(schema.$defs).length} $defs`,
  )
}

main()
