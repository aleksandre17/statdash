// ── useGridLabels — the governed plane-label resolvers for the live grid + offers ──
//
//  The ONE governed-label seam the author plane speaks (Law 4 / FF-AUTHOR-NO-QUERY):
//    • columnLabel — field → governed metric/dimension label (buildColumnLabels).
//    • cellLabel   — (field, member code) → governed member label (buildMemberLabels)
//                    in the author plane; raw SDMX codes in the steward plane.
//  Extracted so BOTH the live grid (PipelineStepGrid) AND the step-editor offers
//  (buildStepInputOffer, via DataWorkbench) resolve labels through the identical
//  catalog + profile — the offered columns/members read exactly as the grid renders.
//
import { useMetricCatalog } from '../../../discovery/useMetricCatalog'
import { useActiveProfile, profileOrNull } from '../../../discovery/useActiveProfile'
import { useActiveLocales } from '../../../inspector/useActiveLocales'
import { useRole } from '../../../studio/useRole'
import type { Locale } from '../../../types/constructor'
import { sourceMeasure, type WorkbenchModel } from '../workbench/workbenchModel'
import { buildColumnLabels, type ColumnLabelResolver } from './columnLabels'
import { buildMemberLabels, rawMemberLabels, type MemberLabelResolver } from './memberLabels'

export interface GridLabels {
  locale:      Locale
  en:          boolean
  /** The author plane hides SDMX plumbing echoes + resolves members; the steward
   *  plane keeps every column raw. */
  isAuthor:    boolean
  columnLabel: ColumnLabelResolver
  cellLabel:   MemberLabelResolver
}

/** Resolve the governed column + member label resolvers for a pipeline head, keyed on
 *  the active catalog / cube profile / role. Fail-soft: before the catalog is ready the
 *  column label is the honest field name; before the profile is ready cells stay raw. */
export function useGridLabels(head: WorkbenchModel['head'] | undefined): GridLabels {
  const locale = (useActiveLocales()[0] ?? 'ka') as Locale
  const en = locale === 'en'
  const catalog = useMetricCatalog()
  const profile = profileOrNull(useActiveProfile())
  const role = useRole()
  const isAuthor = role !== 'steward'

  const columnLabel: ColumnLabelResolver = catalog.status !== 'ready'
    ? (field: string) => field
    : buildColumnLabels({
        metrics:    catalog.metrics,
        dimensions: catalog.dimensions,
        measure:    sourceMeasure(head),
        locale,
      })

  const cellLabel: MemberLabelResolver = isAuthor && profile
    ? buildMemberLabels(profile, locale)
    : rawMemberLabels

  return { locale, en, isAuthor, columnLabel, cellLabel }
}
