// ── GetHead — the workbench source picker (0084 §1) ────────────────────────────
//
//  ADR-046 · SPEC §3.4 · Law 11 (the two-audience canon). The Get head's "pick a source"
//  surface, PLANE-gated by the role lens (ADR-041 §PLANE):
//    • AUTHOR lens  — the governed MetricPalette ONLY (metrics-first, FF-AUTHOR-NO-QUERY
//                     untouched: the author never sees a raw cube / a raw code).
//    • STEWARD lens — two OFFERED tabs: «მეტრიკები» (the same MetricPalette) | «ნედლი კუბები»
//                     (the RawCubePalette — raw-cube access as a ROLE, the Power Query /
//                     Superset / Looker / dbt canon: raw work exists, is strong, and is
//                     plane-gated so published pages never spend reader trust on it).
//
//  The international leaders all give raw access as a ROLE with a promotion loop upward;
//  this is the surface half (the loop is PromoteMetric). WCAG (Law 9): a labelled tablist,
//  keyboard-operable tabs, each panel labelled. Bilingual ka/en.
//
import { useState } from 'react'
import { Box, Tabs, Tab } from '@mui/material'
import { MetricPalette } from '../../../discovery/MetricPalette'
import { useRole } from '../../../studio/useRole'
import type { Locale } from '../../../types/constructor'
import { RawCubePalette } from './RawCubePalette'

export interface GetHeadProps {
  /** Bind a governed metric to the Get head (the metrics tab / author path). */
  onPickMetric: (metricId: string) => void
  /** Browse a raw cube — emit the steward `source(query)` head (steward tab only). */
  onPickCube:   (datasetCode: string, measures: string[]) => void
  /** Active locale for the palettes. */
  locale:       Locale
}

type SourceTab = 'metrics' | 'cubes'

export function GetHead({ onPickMetric, onPickCube, locale }: GetHeadProps) {
  const en = locale === 'en'
  const role = useRole()
  const [tab, setTab] = useState<SourceTab>('metrics')

  // AUTHOR lens: metrics only — no raw tab, ever (fitness-pinned, FF-AUTHOR-NO-QUERY).
  if (role !== 'steward') {
    return (
      <MetricPalette
        locale={locale}
        canBind
        bindHint={en ? 'Pick a governed metric for the source' : 'აირჩიეთ მართული მეტრიკა წყაროსთვის'}
        onBind={onPickMetric}
      />
    )
  }

  // STEWARD lens: metrics | raw cubes — raw access as a role (plane-gated).
  return (
    <Box data-testid="get-head-steward" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Tabs
        value={tab}
        onChange={(_, v: SourceTab) => setTab(v)}
        variant="fullWidth"
        aria-label={en ? 'Source kind' : 'წყაროს ტიპი'}
        sx={{ minHeight: 34, '& .MuiTab-root': { minHeight: 34, py: 0.5, fontSize: 12 } }}
      >
        <Tab value="metrics" label={en ? 'Metrics' : 'მეტრიკები'} data-testid="get-tab-metrics" />
        <Tab value="cubes"   label={en ? 'Raw cubes' : 'ნედლი კუბები'} data-testid="get-tab-cubes" />
      </Tabs>

      {tab === 'metrics' ? (
        <MetricPalette
          locale={locale}
          canBind
          bindHint={en ? 'Pick a governed metric for the source' : 'აირჩიეთ მართული მეტრიკა წყაროსთვის'}
          onBind={onPickMetric}
        />
      ) : (
        <RawCubePalette locale={locale} onPickCube={onPickCube} />
      )}
    </Box>
  )
}
