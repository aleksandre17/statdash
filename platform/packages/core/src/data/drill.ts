// ── drill — the governed dimension-hierarchy drill seam [ADR-034 S4] ─────────────
//
//  The AR-40/50 ⟷ AR-42 bridge: a selection/interaction DECLARES a drill along a
//  dimension's governed hierarchy (DimensionDef.hierarchy — data/dimension.ts), and
//  this seam LOWERS it onto the measure-at-grain algebra. It introduces NO new query
//  path — it COMPOSES the landed M2 SSOT (`evalMeasureAtGrain`), so a drilled read is
//  additivity-respecting by construction (a base measure rolls its descendant leaves
//  up via the store's OLAP cell sum; a ratio / calc metric is RE-DERIVED at each
//  drilled coordinate — never summed, FF-NO-SUM-OF-RATIO holds).
//
//  THE MOVE (why no metric-grain change is needed):
//    A drill picks a target LEVEL of the hierarchy. The members at that level REIFY
//    from the SDMX codelist parent edges (membersAtDepth — Law 5, no double-authoring).
//    Reading each member as a grain-∅ governed cell at `ctx.dims ⊕ { axis: member }`
//    yields exactly the drilled series: the store already sums a parent (rollup) code
//    over its descendant leaves (DimResolver leaf-set expand), and a calc metric
//    re-derives at the pinned coordinate. Enumerating the target-level members is the
//    ONLY thing raw fact-driven grain enumeration cannot do (facts carry leaves, not
//    rollups) — so the drill supplies the coordinate SET and delegates the cell read.
//
//  Grain-aware: a metric queried at level L, drilled to L+1, re-aggregates coherently —
//  the finer coordinate set changes the grain, and each cell re-derives correctly.
//  Law 1 generic (the axis is any dim code; works for geo, sector, any dim-pair);
//  Law 2 declarative (DrillTarget is pure data); arrow-clean (core → data only).
//

import type { DimensionDef, DimensionHierarchy, HierarchyLevel } from './dimension'
import type { EngineRow }        from './encoding'
import type { SectionContext }   from '../core/context'
import type { DataStore }        from './store'
import type { Classifier, DimVal } from '../sdmx'
import { membersAtDepth }        from './codelist'
import { evalMeasureAtGrain }    from './metric-grain'

/**
 * reifyHierarchy — DERIVE a `DimensionHierarchy` from a codelist's parent-edge DEPTH
 * (Law 5 — the codelist is the SSOT; the levels are NOT hand-authored). This is the
 * PROJECTION half of the drill: a self-nested axis with `parent` edges yields one
 * level per tree depth (coarsest root → finest leaf), each naming the SAME generic
 * axis (Law 1); a FLAT codelist (no parent edges → a single depth) yields `undefined`
 * (no drill path — a flat dimension stays flat, byte-identical). The level COUNT is
 * the reified tree depth, never a hand-authored number.
 *
 * The in-memory TWIN of the api bootstrap's server-side projection
 * (`MAX(nlevel(code_path))` over `stats.classifier`) — both reify the SAME fact (the
 * codelist tree depth) from the ONE SSOT, each in its own layer (SQL at the DB, this
 * in core; the api cannot import core across the arrow). Optional `labels` supply the
 * governed per-tier breadcrumbs (Law 4) when the caller has them; absent ⇒ label-less
 * levels (the drill still works — `reifyLevelMembers`/`drillAxis` need only `dim`).
 */
export function reifyHierarchy(
  classifier: Classifier | undefined,
  axis:       string,
  labels?:    (HierarchyLevel['label'])[],
): DimensionHierarchy | undefined {
  if (!classifier) return undefined
  // Deepest tree depth carrying any member — membersAtDepth(0) = roots (always
  // present for a non-empty codelist); a flat codelist has NO member at depth ≥ 1.
  let maxDepth = 0
  while (membersAtDepth(classifier, maxDepth + 1).length > 0) maxDepth++
  if (maxDepth === 0) return undefined   // flat → no drill path
  const levels: HierarchyLevel[] = Array.from({ length: maxDepth + 1 }, (_v, i) => {
    const label = labels?.[i]
    return label !== undefined ? { dim: axis, label } : { dim: axis }
  })
  return { levels }
}

/**
 * A declared drill along a governed hierarchy — the AR-42 selection/interaction
 * emits this; the seam lowers it. Pure data (Law 2), generic dim (Law 1).
 */
export interface DrillTarget {
  /** The DimensionDef id (registry key) whose hierarchy to descend. */
  dimension: string
  /**
   * Target level index into `hierarchy.levels` (0 = coarsest root). A "drill down"
   * from level L is target `L + 1`; a "roll up" is `L - 1`. The seam clamps.
   */
  level:     number
}

/** The level at `index`, clamped into range; undefined for an empty/absent hierarchy. */
function levelAt(def: DimensionDef, index: number): HierarchyLevel | undefined {
  const levels = def.hierarchy?.levels
  if (!levels || levels.length === 0) return undefined
  const clamped = Math.max(0, Math.min(index, levels.length - 1))
  return levels[clamped]
}

/**
 * The GRAIN AXIS (dim code) a hierarchy level groups by — the axis a drilled metric
 * query binds as its grain. This is the star-form bridge: a metric queried with
 * `by: [drillAxis(def, target.level)]` re-aggregates at the target level natively
 * through metric-grain. Undefined ⇒ no hierarchy (a flat dimension).
 */
export function drillAxis(def: DimensionDef, level: number): string | undefined {
  return levelAt(def, level)?.dim
}

/**
 * The DEPTH of a level WITHIN its own axis — how many prior levels (index ≤ level)
 * name the SAME axis. For a self-nested codelist (every level on one axis) this is
 * the level index itself; for a star hierarchy (each axis appears once) it is 0. This
 * is the codelist tree depth the level's members reify from — the ONE rule that
 * unifies both forms without a privileged branch (Law 1).
 */
function depthWithinAxis(def: DimensionDef, level: number): number {
  const levels = def.hierarchy?.levels ?? []
  const clamped = Math.max(0, Math.min(level, levels.length - 1))
  const axis = levels[clamped]?.dim
  let depth = 0
  for (let i = 0; i < clamped; i++) if (levels[i]?.dim === axis) depth++
  return depth
}

/**
 * reifyLevelMembers — the coordinate SET at a drill level, REIFIED from the SDMX
 * codelist parent edges (Law 5 — never hand-authored). Members at within-axis depth
 * D of the level's classifier: a self-nested geo hierarchy reads countries at level 0,
 * regions at 1, municipalities at 2; a flat star axis reports all its codes at depth 0.
 * Empty for an absent hierarchy / missing classifier.
 */
export function reifyLevelMembers(
  def:        DimensionDef,
  level:      number,
  classifier: Classifier | undefined,
): DimVal[] {
  if (!classifier || !def.hierarchy?.levels?.length) return []
  return membersAtDepth(classifier, depthWithinAxis(def, level))
}

/**
 * evalMetricDrill — read a governed measure at a DRILLED coordinate set. The store-
 * aware seam that PROVES grain-aware, additivity-respecting drill: for each reified
 * member at the target level, point-read the measure at `ctx.dims ⊕ { axis: member }`
 * via the M2 grain-∅ SSOT (`evalMeasureAtGrain`). A base measure's cell sums the
 * member's descendant leaves (OLAP rollup); a calc / non-additive measure RE-DERIVES
 * at that coordinate (never summed — FF-NO-SUM-OF-RATIO). Emits one `{ [axis]: member,
 * value, id, label }` EngineRow per member — the SAME uniform shape the metric resolver
 * reshapes, so a drilled series renders identically to a grain-enumerated one.
 *
 * At the LEAF level of a self-nested (or a flat star) axis the reified member set is
 * exactly the distinct fact coordinates, so a leaf drill is EQUIVALENT to
 * `evalMeasureAtGrain(ref, ctx, store, [axis])` — the reversible-expansion parity a
 * fitness test asserts. Delegates all algebra to the guarded SSOT; adds only the
 * codelist-reified enumeration facts cannot provide.
 */
export function evalMetricDrill(
  ref:        string,
  def:        DimensionDef,
  target:     DrillTarget,
  ctx:        SectionContext,
  store:      DataStore,
  classifier: Classifier | undefined,
): EngineRow[] {
  const axis = drillAxis(def, target.level)
  if (!axis) return []
  const members = reifyLevelMembers(def, target.level, classifier)

  const out: EngineRow[] = []
  for (const member of members) {
    const scoped: SectionContext = { ...ctx, dims: { ...ctx.dims, [axis]: member } as Record<string, DimVal> }
    const [cell] = evalMeasureAtGrain(ref, scoped, store, [])   // grain-∅ = one governed cell
    out.push({ [axis]: member, value: cell?.value ?? 0, id: String(member), label: String(member) })
  }
  return out
}
