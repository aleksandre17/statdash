import { useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  DEFAULT_STUDIO_SURFACE,
  STUDIO_SURFACES,
  type StudioSurface,
} from '../types/constructor'

// ── useStudioRoute — the URL is the ONE source of truth for the Studio surface ──
//
//  The owner's "activate, not shadow": the activity-rail surface (and the selected
//  page) live in the ADDRESS BAR, not a shadow store flag. Clicking a surface pushes
//  a real history entry (browser Back/Forward work), and a pasted `/studio/<surface>`
//  URL opens that surface (permalink). The store no longer holds `activeSurface` — a
//  single source, no dual-state drift (the D-SL-2a "route, never a step" deferral is
//  now the real route it always described).
//
//  Scheme (one path segment per surface, the id doubles as the segment):
//    /studio/:surface   — surface ∈ STUDIO_SURFACES (insert·data·layers·pages-site·style·model)
//    ?page=<pageId>     — the selected canvas page, a query refinement that rides
//                         across surface changes (bound to the store in StudioShell).
//  Node/band/chrome selection stays EPHEMERAL (transient editing state) — not routed.

export const STUDIO_BASE = '/studio'

/** The canonical path for a surface — the single place the scheme is spelled. */
export const studioSurfacePath = (surface: StudioSurface) => `${STUDIO_BASE}/${surface}`

// ── The ONE Data workspace floors — a DECLARATION (ADR-051 DU1 · DU6-IA-1) ──────
//  The `data` surface is ONE destination whose internal IA is a ladder of in-workspace
//  FLOORS. DU6-IA-1 makes the floor SET a declaration (`FF-FLOOR-IS-DECLARED`): the
//  three in-workspace floors — Sources → Model → Specs — are the SSOT the selector,
//  the deep-links and the tests all project from; a new floor is one entry here, never a
//  scattered `=== 'model'` conditional. (Floor 4, elements, stays on the canvas — the
//  ladder ends with a link chip «ელემენტები — კანვასზე ↗», not a toggle.)
//  Which floor is open rides a query param so the floor is deep-linkable (a pasted
//  `/studio/data?dataFloor=specs` opens the Specs floor) and the legacy `/studio/model`
//  redirect preserves its intent. Default = `sources` — the source is step 0 («ჯერ
//  მონაცემი»), the honest first affordance.
export const DATA_FLOOR_PARAM = 'dataFloor'

/** The declared floor ids of the ONE Data workspace — the projection SSOT (DU6-IA-1). */
export const DATA_FLOOR_IDS = ['sources', 'model', 'specs'] as const
export type DataFloor = typeof DATA_FLOOR_IDS[number]
export const DEFAULT_DATA_FLOOR: DataFloor = 'sources'

/** Narrow a raw query value to a declared floor (unknown/absent → the default, step 0). */
export function parseDataFloor(raw: string | null | undefined): DataFloor {
  return (DATA_FLOOR_IDS as readonly string[]).includes(raw ?? '')
    ? (raw as DataFloor)
    : DEFAULT_DATA_FLOOR
}

/** Path to the ONE Data workspace, optionally opening a named floor (ADR-051 DU1).
 *  Pair with `SPEC_PARAM` to also deep-link a selected spec on the Specs floor. */
export const studioDataPath = (floor?: DataFloor) =>
  `${studioSurfacePath('data')}${floor ? `?${DATA_FLOOR_PARAM}=${floor}` : ''}`

// ── The Specs floor's durable selection (DU6-IA-1 F1, Law 9 — URL = permalink) ─────
//  Which spec is open in the workbench takeover is DURABLE UI state, not ephemeral —
//  it rides the URL (never local `useState`) so a seeded/selected workbench survives a
//  refresh or a pasted link, one canonical spelling (`?dataFloor=specs&spec=<id>`).
export const SPEC_PARAM = 'spec'

// ── The in-workspace "browse this cube" seed (ADR-051 DU2) ──────────────────────
//  DU2 retires the cross-screen courier (`store/sourcesHandoff`). "Browse this cube in
//  the workbench" is now an IN-WORKSPACE selection: the Sources floor seeds the source
//  step in place by switching to the Model floor with the picked cube RIDING THE URL —
//  the SAME DU1 plumbing the floor itself rides (`?dataFloor`), never a one-shot store.
//  The seed is fully self-describing (datasetCode + its measures + its store home, all
//  resolved at the origin gesture — race-free, 0089-faithful), so a pasted link replays
//  it and the workbench never depends on transient cross-render state (Law 2 / Law 6).
export const CUBE_SEED_PARAM     = 'cube'         // the picked dataset code (identity + seeded name)
export const CUBE_MEASURES_PARAM = 'cubeMeasures' // its measure codes (comma-joined) — the steward head reads these
export const CUBE_STORE_PARAM    = 'cubeStore'    // the cube's store HOME (0089), resolved at the pick

/** The seed's URL keys — cleared as ONE unit once the workbench consumes it (one-shot). */
export const WORKBENCH_SEED_PARAMS = [CUBE_SEED_PARAM, CUBE_MEASURES_PARAM, CUBE_STORE_PARAM] as const

/** A one-shot "browse this raw cube in the workbench" intent (ADR-051 DU2 — the ex-courier payload). */
export interface WorkbenchCubeSeed {
  datasetCode: string
  measures:    string[]
  dataSource?: string
}

/** Path to the Data workspace's Specs floor, seeded to browse `seed` in the workbench.
 *  Same `/studio/data` surface (an in-workspace floor switch, never a cross-surface teleport).
 *  DU6-IA-1: the workbench + its seed consumer now live on the Specs floor (extracted from
 *  the retired Model-floor modeler), so a browse-in-workbench gesture targets `dataFloor=specs`. */
export function studioDataWorkbenchPath(seed: WorkbenchCubeSeed): string {
  const p = new URLSearchParams()
  p.set(DATA_FLOOR_PARAM, 'specs')
  p.set(CUBE_SEED_PARAM, seed.datasetCode)
  if (seed.measures.length) p.set(CUBE_MEASURES_PARAM, seed.measures.join(','))
  if (seed.dataSource)      p.set(CUBE_STORE_PARAM, seed.dataSource)
  return `${studioSurfacePath('data')}?${p.toString()}`
}

/** Decode a pending workbench cube seed from the URL — null when none is present. */
export function readWorkbenchSeed(params: URLSearchParams): WorkbenchCubeSeed | null {
  const datasetCode = params.get(CUBE_SEED_PARAM)
  if (!datasetCode) return null
  return {
    datasetCode,
    measures:   params.get(CUBE_MEASURES_PARAM)?.split(',').filter(Boolean) ?? [],
    dataSource: params.get(CUBE_STORE_PARAM) ?? undefined,
  }
}

/** Narrow a raw route param to a known surface (an unknown segment is not one). */
export function isStudioSurface(value: string | undefined): value is StudioSurface {
  return value != null && (STUDIO_SURFACES as readonly string[]).includes(value)
}

/**
 * The active surface, DERIVED from the `:surface` route param. An unknown/absent
 * segment resolves to the default (defensive — the redirect route normally prevents
 * this, but a hook must never return an invalid surface).
 */
export function useActiveSurface(): StudioSurface {
  const { surface } = useParams()
  return isStudioSurface(surface) ? surface : DEFAULT_STUDIO_SURFACE
}

/**
 * The surface setter — a real navigation (`setSurface → navigate`). The current
 * query string (notably `?page=`) is PRESERVED so switching surfaces keeps the
 * selected page. Pushes a history entry, so Back returns to the prior surface.
 */
export function useSetSurface(): (surface: StudioSurface) => void {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  return useCallback(
    (surface: StudioSurface) => {
      const qs = search.toString()
      navigate({ pathname: studioSurfacePath(surface), search: qs ? `?${qs}` : '' })
    },
    [navigate, search],
  )
}
