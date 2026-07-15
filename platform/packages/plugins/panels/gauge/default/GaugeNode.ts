import type { NodeBase, PropertyGroup } from '@statdash/react/engine'
import type { FieldConfig, Threshold }               from '@statdash/engine'
import { DATA_INTEGRITY_SCHEMA, DATA_INTEGRITY_FIELDS } from '../../dataIntegritySchema'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../schema-contract'

export interface GaugeNode extends NodeBase {
  type: 'gauge'
  /** Explicit "preliminary data" override (Law 9) — signal #1 of resolvePreliminary. */
  preliminary?: boolean
  /** Field from rows to display as the gauge value. Default: 'value' */
  valueField?:  string
  /** Minimum gauge value. Default: 0 */
  min?:         number
  /** Maximum gauge value. Default: 100 */
  max?:         number
  /**
   * Thresholds — same format as FieldConfig.thresholds.
   * Threshold.value: null = base color; number = activation value.
   * `resolveThresholdColor` from @statdash/engine evaluates these.
   */
  thresholds?:  FieldConfig['thresholds']
  /** Show the numeric value label inside the gauge arc. Default: true */
  showValue?:   boolean
}

// ── ThresholdItemSchema — the per-STEP nested schema (D7.2 / ADR-022) ────────
//  One Threshold step: activation `value` (null = base color, authored as a number
//  or cleared), `color`, optional `label`. Declared BEFORE GaugeSchema (const
//  init order) since GaugeSchema references it.
export const ThresholdItemSchema = defineSchema([
  { field: 'value', type: 'number', concern: 'data',    label: { ka: 'ზღვრის მნიშვნელობა', en: 'Threshold value' } },
  { field: 'color', type: 'color',  concern: 'style',   label: { ka: 'ფერი',              en: 'Colour' }, required: true },
  { field: 'label', type: 'string', concern: 'content', label: { ka: 'წარწერა',           en: 'Label' } },
])

// FF-SCHEMA-COMPLETE depth (tier c): 1:1 with Threshold's editable keys.
export type _ThresholdItemCovers = Expect<AssertSchemaCovers<Threshold, typeof ThresholdItemSchema>>

export const GaugeSchema = defineSchema([
  {
    field:   'valueField',
    type:    'string',
    label:   { ka: 'მნიშვნელობის ველი', en: 'Value field' },
    default: 'value',
  },
  {
    field:   'min',
    type:    'number',
    label:   { ka: 'მინიმუმი', en: 'Minimum' },
    default: 0,
  },
  {
    field:   'max',
    type:    'number',
    label:   { ka: 'მაქსიმუმი', en: 'Maximum' },
    default: 100,
  },
  {
    field:   'showValue',
    type:    'boolean',
    label:   { ka: 'მნიშვნელობის ჩვენება', en: 'Show value' },
    default: true,
  },
  {
    // Threshold[] is an ARRAY (corrected from the prior mistaken `object`), now a
    // STRUCTURED nested field authored step-by-step (D7.2 / ADR-022). The schema
    // TYPE descriptor is authoring metadata only — the stored value (a Threshold[])
    // is byte-identical; only the editor changes (JsonControl → ArrayOfControl).
    field: 'thresholds',
    type:  'array',
    label: { ka: 'ზღვრები', en: 'Thresholds' },
    itemSchema: ThresholdItemSchema,
    itemLabel: 'label',
  },
  ...DATA_INTEGRITY_SCHEMA,
])

// FF-SCHEMA-COMPLETE (tier b): 1:1 with editable keys. `thresholds` (Threshold[])
// is now a STRUCTURED nested field. `preliminary` covered via the shared fragment.
export type _GaugeCovers = Expect<AssertSchemaCovers<GaugeNode, typeof GaugeSchema>>

export const GaugeGroups: PropertyGroup[] = [
  {
    label:  { ka: 'მონაცემები', en: 'Data' },
    fields: ['valueField', 'min', 'max'],
  },
  {
    label:  { ka: 'ვიზუალიზაცია', en: 'Display' },
    fields: ['showValue', 'thresholds'],
  },
  {
    label:  { ka: 'მონაცემთა მთლიანობა', en: 'Data integrity' },
    fields: [...DATA_INTEGRITY_FIELDS],
  },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'gauge': GaugeNode }
}
