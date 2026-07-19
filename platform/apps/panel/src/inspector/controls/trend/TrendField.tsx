// ── TrendField — the TREND control (PropFieldType 'trend') ───────────────────────
//
//  ADR-049 P2a Lane 3 builds the MISSING projection (not a buried one): a KPI-strip /
//  featured-slider item's `trend` was authored as raw `type:'object'` JSON at ~33 sites.
//  This control gives the `KpiTrendSpec` discriminated union (yoy / cagr / share / static)
//  a first-class authoring surface, registered in FieldControlRegistry under `type:'trend'`
//  so the generic Inspector dispatches every trend site to it (FF-TREND-HAS-PROJECTION —
//  no raw-JSON fall-through).
//
//  Structure (a bounded editor, no raw JSON — FF-NO-RAW-JSON-DEFAULT), mirroring EventsField:
//    • a DISCRIMINANT selector — None + the four KpiTrendSpec kinds; picking one seeds a
//      valid shell (retypeTrend carries `measure` across a yoy↔cagr switch).
//    • the chosen variant's FIELDS — projected through the SAME generic Inspector over
//      TREND_VARIANT_SCHEMAS[type] (a governed measure is an enum-ref, Law 2), never a
//      bespoke per-variant form (the Bounded-Element mandate).
//
//  Controlled component: value in (the current KpiTrendSpec | undefined), onChange out
//  (the next whole trend, or undefined to clear). WCAG 2.1 AA: labelled select, the nested
//  fields inherit the Inspector's labelled controls + keyboard reach.
//
import { Box, Typography } from '@mui/material'
import { Select } from '@statdash/react'
import type { FieldControlProps } from '../../fieldControl.types'
import { Inspector } from '../../Inspector'
import { readLocale } from '../../localeString'
import { fixedSchemaSource } from '../nestedItemControl.helpers'
import type { CanvasNode } from '../../../types/constructor'
import {
  TREND_TYPES, TREND_TYPE_LABELS, TREND_VARIANT_SCHEMAS, TREND_NONE,
  retypeTrend, type TrendType,
} from './trendVariantSchemas'

type TrendValue = ({ type?: TrendType } & Record<string, unknown>) | undefined

export function TrendField({ id, value, locale, onChange }: FieldControlProps) {
  const trend = value as TrendValue
  const en = locale === 'en'
  const type = trend?.type
  const schema = type ? TREND_VARIANT_SCHEMAS[type] : undefined

  const trendNode: CanvasNode = {
    id: `${id}-trend`,
    type: 'trend-spec',
    props: (trend ?? {}) as Record<string, unknown>,
    childIds: [],
  }

  return (
    <Box
      className="insp-trend"
      data-testid="trend-field"
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
    >
      {/* ── The discriminant — None + the four KpiTrendSpec kinds ─────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 44 }}>
          {en ? 'Kind' : 'ტიპი'}
        </Typography>
        <Select.Root
          value={type ?? TREND_NONE}
          onValueChange={(v) => onChange(retypeTrend(trend, v as TrendType | typeof TREND_NONE))}
        >
          <Select.Trigger
            aria-label={en ? 'Trend kind' : 'ტრენდის ტიპი'}
            data-testid="trend-kind"
            style={{ flex: 1 }}
          />
          <Select.Content>
            <Select.Item value={TREND_NONE}>{en ? 'None' : 'არცერთი'}</Select.Item>
            {TREND_TYPES.map((t) => (
              <Select.Item key={t} value={t}>{readLocale(TREND_TYPE_LABELS[t], locale)}</Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </Box>

      {/* ── The chosen variant's fields — projected through the SAME generic Inspector ── */}
      {schema && (
        <Box
          data-testid="trend-variant"
          sx={{ pl: 1.5, borderLeft: '2px solid', borderColor: 'divider' }}
        >
          <Inspector
            node={trendNode}
            schemaSource={fixedSchemaSource(schema, [])}
            onChange={(field, next) => onChange({ ...(trend ?? {}), [field]: next })}
            idPrefix={`${id}-trend`}
          />
        </Box>
      )}
    </Box>
  )
}
