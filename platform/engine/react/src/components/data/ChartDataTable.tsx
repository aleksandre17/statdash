// ── ChartDataTable — accessible data table behind every chart [N15] ───
//
//  ONS / Eurostat / W3C pattern: every chart exposes a screen-reader-usable
//  data table. The visual chart is `aria-hidden="true"`; this table is the
//  AT-facing representation.
//
//  Usage (inside Chart.tsx):
//    <div aria-hidden="true">{/* visual renderer */}</div>
//    <ChartDataTable output={output} label={ariaLabel} />
//
//  The component is locale-agnostic: column/row labels come from ChartOutput
//  (already localised by interpretChart), not from any hardcoded strings here.
//

import React          from 'react'
import type { ChartOutput } from '@geostat/charts'

interface ChartDataTableProps {
  output: ChartOutput
  /**
   * Accessible label for the table — typically the series names joined,
   * as already computed by Chart.tsx. Passed through to aria-label.
   */
  label?: string
}

/**
 * Renders a visually-hidden semantic table from a ChartOutput.
 * Screen readers navigate this instead of the inaccessible SVG chart.
 *
 * A11y contract:
 *   - `<table>` with aria-label (WCAG 1.3.1 Info and Relationships)
 *   - `<th scope="col">` for series headers
 *   - `<th scope="row">` for category labels
 *   - Pre-formatted values from ChartDataPoint.formatted
 */
export function ChartDataTable({ output, label }: ChartDataTableProps): React.ReactElement | null {
  const { categories, series } = output
  if (!categories.length || !series.length) return null

  const tableLabel = label ? `${label} — data table` : 'Chart data'

  return (
    <table className="sr-only" aria-label={tableLabel}>
      <thead>
        <tr>
          {/* Corner cell — intentionally blank; aria-hidden so AT skips it */}
          <td aria-hidden="true" />
          {series.map((s, i) => (
            <th key={i} scope="col">{s.name || `Series ${i + 1}`}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {categories.map((cat, rowIdx) => (
          <tr key={rowIdx}>
            <th scope="row">{cat}</th>
            {series.map((s, colIdx) => (
              <td key={colIdx}>{s.data[rowIdx]?.formatted ?? ''}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
