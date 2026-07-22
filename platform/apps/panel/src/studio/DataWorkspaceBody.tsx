import { lazy, Suspense, useEffect, type ComponentType } from 'react'
import { Box, Button, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material'
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined'
import SchemaOutlinedIcon from '@mui/icons-material/SchemaOutlined'
import PolylineOutlinedIcon from '@mui/icons-material/PolylineOutlined'
import LaunchOutlinedIcon from '@mui/icons-material/LaunchOutlined'
import { useSearchParams } from 'react-router-dom'
import { SourcesBody } from './sources/SourcesBody'
import { DataModelBody } from './DataModelBody'
import { SuspenseFallback } from '../shared/SuspenseFallback'
import {
  DATA_FLOOR_PARAM, parseDataFloor, useSetSurface,
  type DataFloor,
} from './useStudioRoute'
import type { Locale } from '../types/constructor'

// The Specs floor carries the heavy editor suite (DataWorkbench + dnd-kit + the spec
// editors), so it stays behind a lazy boundary — the workspace's eager chunk (the
// Sources + Model floors) never pays that weight until a spec is opened. (The boundary
// the retired ModelSurface→DataModelingPanel lazy import used to provide, kept.)
const SpecsBody = lazy(() => import('./specs/SpecsBody').then((m) => ({ default: m.SpecsBody })))

// ── DataWorkspaceBody — the ONE Data workspace (ADR-051 DU1 · DU6-IA-1) ──────────
//
//  ADR-051 folds the former peer doors into ONE Data destination whose internal IA is a
//  ladder of in-workspace FLOORS. DU6-IA-1 makes that ladder HONEST + DECLARED:
//    · the floor SET is a declaration (`DATA_FLOORS`) — the selector, deep-links and
//      tests all project from it (`FF-FLOOR-IS-DECLARED`); a new floor is one entry,
//      never a scattered `=== 'model'` conditional;
//    · the accepted §1.1 three in-workspace floors are all present and honestly labelled —
//      **წყაროები (Sources) · მოდელი (Model) · სპეც-ები (Specs)** — the owner's "what's
//      above, what's below" made a visible, navigable spine;
//    · Floor 4 (elements) stays on the CANVAS — the ladder ends with a non-toggle link
//      chip «ელემენტები — კანვასზე ↗», not a fourth toggle.
//
//  ── The source is step 0 ──────────────────────────────────────────────────────
//  The workspace opens on the SOURCES floor by default (`parseDataFloor` → `sources`) —
//  the raw cube catalog IS the "pick a source" step-0 picker (Law 11). The other floors
//  are one deep-linkable floor-switch away (`?dataFloor=model` / `?dataFloor=specs`).
//
//  ── Accessibility (WCAG 2.1 AA, Law 9) ────────────────────────────────────────
//  The floor selector is a keyboard-reachable, bilingual toggle group with an accessible
//  name; each floor body owns its own labelled region + on-mount focus.

interface FloorDef {
  id:      DataFloor
  Icon:    ComponentType<{ fontSize?: 'small'; sx?: object }>
  labelKa: string
  labelEn: string
  hintKa:  string
  hintEn:  string
  Body:    ComponentType<{ locale: Locale }>
}

// The DECLARATION — the floor ladder as data (the selector/deep-links project from it).
export const DATA_FLOORS: readonly FloorDef[] = [
  {
    id: 'sources', Icon: StorageOutlinedIcon,
    labelKa: 'წყაროები', labelEn: 'Sources',
    hintKa: 'წყაროები — ნედლი კუბები (აირჩიე წყარო, ნაბიჯი 0)',
    hintEn: 'Sources — raw cubes (pick a source, step 0)',
    Body: SourcesBody,
  },
  {
    id: 'model', Icon: SchemaOutlinedIcon,
    labelKa: 'მოდელი', labelEn: 'Model',
    hintKa: 'მოდელი — მართული სემანტიკური მოდელი (მეტრიკები)',
    hintEn: 'Model — the governed semantic model (metrics)',
    Body: DataModelBody,
  },
  {
    id: 'specs', Icon: PolylineOutlinedIcon,
    labelKa: 'სპეც-ები', labelEn: 'Specs',
    hintKa: 'სპეც-ები — მოთხოვნები და პაიპლაინები (workbench)',
    hintEn: 'Specs — queries and pipelines (workbench)',
    Body: SpecsBody,
  },
]

export function DataWorkspaceBody({ locale }: { locale: Locale }) {
  const [params, setParams] = useSearchParams()
  const setSurface = useSetSurface()
  const en = locale === 'en'

  // The open floor rides the URL (deep-linkable); unknown/absent → the source (step 0).
  const rawFloor = params.get(DATA_FLOOR_PARAM)
  const floor: DataFloor = parseDataFloor(rawFloor)
  const setFloor = (next: DataFloor) =>
    setParams(
      (prev) => {
        const merged = new URLSearchParams(prev)
        merged.set(DATA_FLOOR_PARAM, next)
        return merged
      },
      { replace: true },
    )

  // ── DU6-IA-1 F2+F3 — one canonical URL per floor (Law 9: URL = permalink) ─────────
  //  An ABSENT or INVALID `dataFloor` still renders (parseDataFloor's default), but the
  //  address bar must never keep lying about which floor is actually open. Rewrite it
  //  ONCE to the explicit resolved id (`replace`, no extra history entry, every other
  //  param preserved) — guarded so it only fires when the raw value disagrees with the
  //  resolved one (never a rewrite loop).
  useEffect(() => {
    if (rawFloor === floor) return
    setParams(
      (prev) => {
        const merged = new URLSearchParams(prev)
        merged.set(DATA_FLOOR_PARAM, floor)
        return merged
      },
      { replace: true },
    )
  }, [rawFloor, floor, setParams])

  const active = DATA_FLOORS.find((f) => f.id === floor) ?? DATA_FLOORS[0]
  const ActiveBody = active.Body

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* The ladder made visible — the in-workspace floor selector, PROJECTED from the
          DATA_FLOORS declaration (FF-FLOOR-IS-DECLARED), plus the canvas link chip. */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Box data-testid="data-floor-selector">
          <ToggleButtonGroup
            exclusive
            size="small"
            value={floor}
            onChange={(_, next: DataFloor | null) => { if (next) setFloor(next) }}
            aria-label={en ? 'Data workspace floor' : 'მონაცემთა სამუშაო სივრცის სართული'}
          >
            {DATA_FLOORS.map(({ id, Icon, labelKa, labelEn, hintKa, hintEn }) => (
              <Tooltip key={id} title={en ? hintEn : hintKa}>
                <ToggleButton value={id} aria-label={en ? labelEn : labelKa}>
                  <Icon fontSize="small" sx={{ mr: 0.5 }} />
                  {en ? labelEn : labelKa}
                </ToggleButton>
              </Tooltip>
            ))}
          </ToggleButtonGroup>
        </Box>

        {/* Floor 4 (elements) lives on the canvas — a non-toggle link up the ladder. */}
        <Tooltip title={en ? 'Elements are placed on the canvas' : 'ელემენტები კანვასზე თავსდება'}>
          <Button
            size="small"
            variant="text"
            color="inherit"
            endIcon={<LaunchOutlinedIcon fontSize="small" />}
            data-testid="data-floor-canvas-link"
            onClick={() => setSurface('insert')}
            sx={{ textTransform: 'none' }}
          >
            {en ? 'Elements — on the canvas' : 'ელემენტები — კანვასზე'}
          </Button>
        </Tooltip>
      </Box>

      <Suspense fallback={<SuspenseFallback label="Loading floor" fill={false} />}>
        <ActiveBody locale={locale} />
      </Suspense>
    </Box>
  )
}
