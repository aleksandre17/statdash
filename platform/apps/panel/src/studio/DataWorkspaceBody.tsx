import { Box, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material'
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined'
import SchemaOutlinedIcon from '@mui/icons-material/SchemaOutlined'
import { useSearchParams } from 'react-router-dom'
import { SourcesBody } from './sources/SourcesBody'
import { DataModelBody } from './DataModelBody'
import { DATA_FLOOR_PARAM, type DataFloor } from './useStudioRoute'
import type { Locale } from '../types/constructor'

// ── DataWorkspaceBody — the ONE Data workspace (ADR-051 DU1) ────────────────────
//
//  ADR-051 folds the two former peer doors — «წყაროები» (Sources) and «მოდელი»
//  (Model) — into ONE Data destination whose internal IA is the four-floor ladder the
//  dependency arrow already dictates:  Sources (raw cubes) → Model (governed metrics) →
//  Pipelines (specs) → the element. These are FLOORS OF ONE WORKSPACE, reached by an
//  in-workspace floor selector — never two peer rail doors, never a cross-screen teleport
//  (FF-ONE-DATA-WORKSPACE). The reference class is unanimous (Power Query / Grafana /
//  Retool / Looker): data lives behind one workspace with the source as step 0.
//
//  ── The source is step 0 ──────────────────────────────────────────────────────
//  The workspace opens on the SOURCES floor by default (`?dataFloor=sources`) — the raw
//  cube catalog IS the "pick a source" step-0 picker (Law 11: the canvas never lies —
//  an honest affordance, never a fake empty grid). The Model floor (the governed
//  dictionary / modeler) is one floor-switch away, deep-linkable via `?dataFloor=model`
//  (the courier's legacy `/studio/model` redirect lands there so browse-in-workbench
//  keeps working until DU2 retires it).
//
//  ── DU1 scope — SHELL/IA unification only ─────────────────────────────────────
//  This wave composes the two EXISTING bodies as floors; it adds no engine change and no
//  new editor. The Pipelines + element floors of the ladder are the workbench + the
//  per-element inspector already reached elsewhere; they join this switcher as ADR-051
//  progresses (DU2 kills the courier, DU3 the second raw editor). Floors, not screens.
//
//  ── Accessibility (WCAG 2.1 AA, Law 9) ────────────────────────────────────────
//  The floor selector is a keyboard-reachable, bilingual toggle group with an accessible
//  name; each floor body owns its own labelled region + on-mount focus (unchanged).
export function DataWorkspaceBody({ locale }: { locale: Locale }) {
  const [params, setParams] = useSearchParams()
  const en = locale === 'en'

  // The open floor rides the URL (deep-linkable); default = the source (step 0).
  const floor: DataFloor = params.get(DATA_FLOOR_PARAM) === 'model' ? 'model' : 'sources'
  const setFloor = (next: DataFloor) =>
    setParams(
      (prev) => {
        const merged = new URLSearchParams(prev)
        merged.set(DATA_FLOOR_PARAM, next)
        return merged
      },
      { replace: true },
    )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* The ladder made visible — the in-workspace floor selector (Sources → Model). */}
      <Box data-testid="data-floor-selector">
        <ToggleButtonGroup
          exclusive
          size="small"
          value={floor}
          onChange={(_, next: DataFloor | null) => { if (next) setFloor(next) }}
          aria-label={en ? 'Data workspace floor' : 'მონაცემთა სამუშაო სივრცის სართული'}
        >
          <Tooltip title={en ? 'Sources — raw cubes (pick a source, step 0)' : 'წყაროები — ნედლი კუბები (აირჩიე წყარო, ნაბიჯი 0)'}>
            <ToggleButton value="sources" aria-label={en ? 'Sources' : 'წყაროები'}>
              <StorageOutlinedIcon fontSize="small" sx={{ mr: 0.5 }} />
              {en ? 'Sources' : 'წყაროები'}
            </ToggleButton>
          </Tooltip>
          <Tooltip title={en ? 'Model — the governed semantic model' : 'მოდელი — მართული სემანტიკური მოდელი'}>
            <ToggleButton value="model" aria-label={en ? 'Model' : 'მოდელი'}>
              <SchemaOutlinedIcon fontSize="small" sx={{ mr: 0.5 }} />
              {en ? 'Model' : 'მოდელი'}
            </ToggleButton>
          </Tooltip>
        </ToggleButtonGroup>
      </Box>

      {floor === 'sources'
        ? <SourcesBody locale={locale} />
        : <DataModelBody locale={locale} />}
    </Box>
  )
}
