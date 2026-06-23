// ── Annotation resolution — chart plugin local ────────────────────────
//
//  Resolves AnnotationSpec[] (declarative) to ResolvedAnnotation[] (concrete).
//  Static annotations use spec.value directly.
//  Dynamic annotations call interpretSpec(spec.data, sectionCtx, store)
//  and read rows[0]['value'].
//
//  Chart-plugin-local types: do NOT export from @statdash/engine.
//  Dep arrow: plugins → engine (correct).
//

import { interpretSpec }           from '@statdash/engine'
import type { SectionContext, DataSpec, DataStore } from '@statdash/engine'

// ── Types ─────────────────────────────────────────────────────────────

export type AnnotationAxis = 'x' | 'y'

export interface AnnotationSpec {
  /** Which axis this annotation draws on */
  axis:      AnnotationAxis
  /** Static value to draw the line/band at. Mutually exclusive with data. */
  value?:    number | string
  /** Dynamic: resolve this DataSpec and use the first row's `value` field */
  data?:     DataSpec
  /** Display label shown on the chart */
  label?:    string
  /** Optional: end value for a band (instead of a line) */
  valueTo?:  number | string
  /** Color override (default: from theme) */
  color?:    string
}

export interface ResolvedAnnotation {
  axis:     AnnotationAxis
  value:    number | string | undefined
  valueTo?: number | string
  label?:   string
  color?:   string
}

// ── resolveAnnotations ────────────────────────────────────────────────

/**
 * Resolve AnnotationSpec[] to ResolvedAnnotation[].
 *
 * Pure function — safe to call inside useMemo.
 * Dynamic specs call interpretSpec (via store) for the first row's value field.
 */
export function resolveAnnotations(
  specs:      AnnotationSpec[],
  sectionCtx: SectionContext,
  store:      DataStore,
): ResolvedAnnotation[] {
  return specs.map((spec): ResolvedAnnotation => {
    let value: number | string | undefined = spec.value

    if (spec.data) {
      const rows = interpretSpec(spec.data, sectionCtx, store)
      const first = rows[0]
      if (first !== undefined) {
        const raw = first['value']
        value = raw !== undefined && raw !== null
          ? (typeof raw === 'number' ? raw : String(raw))
          : undefined
      }
    }

    return {
      axis:    spec.axis,
      value,
      ...(spec.valueTo !== undefined ? { valueTo: spec.valueTo } : {}),
      ...(spec.label   !== undefined ? { label:   spec.label   } : {}),
      ...(spec.color   !== undefined ? { color:   spec.color   } : {}),
    }
  })
}

// ── toApexAnnotations ─────────────────────────────────────────────────
//
//  Maps ResolvedAnnotation[] to ApexCharts `annotations` option shape.
//  Chart-local: ApexCharts knowledge lives only in plugins/panels/chart/.
//

export interface ApexAnnotationsShape {
  yaxis: {
    y:           number | string | undefined
    y2?:         number | string
    label:       { text: string }
    borderColor: string
  }[]
  xaxis: {
    x:           number | string | undefined
    x2?:         number | string
    label:       { text: string }
    borderColor: string
  }[]
}

export function toApexAnnotations(
  resolved: ResolvedAnnotation[],
): ApexAnnotationsShape {
  return {
    yaxis: resolved
      .filter(a => a.axis === 'y')
      .map(a => ({
        y:           a.value,
        ...(a.valueTo !== undefined ? { y2: a.valueTo } : {}),
        label:       { text: a.label ?? '' },
        borderColor: a.color ?? '#999',
      })),
    xaxis: resolved
      .filter(a => a.axis === 'x')
      .map(a => ({
        x:           a.value,
        ...(a.valueTo !== undefined ? { x2: a.valueTo } : {}),
        label:       { text: a.label ?? '' },
        borderColor: a.color ?? '#999',
      })),
  }
}
