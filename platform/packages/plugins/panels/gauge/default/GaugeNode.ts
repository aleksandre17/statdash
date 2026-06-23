import type { NodeBase, PropertyGroup, PropSchema } from '@statdash/react/engine'
import type { FieldConfig }                         from '@statdash/engine'

export interface GaugeNode extends NodeBase {
  type: 'gauge'
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

export const GaugeSchema: PropSchema = [
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
    field: 'thresholds',
    type:  'object',
    label: { ka: 'ზღვრები', en: 'Thresholds' },
  },
]

export const GaugeGroups: PropertyGroup[] = [
  {
    label:  { ka: 'მონაცემები', en: 'Data' },
    fields: ['valueField', 'min', 'max'],
  },
  {
    label:  { ka: 'ვიზუალიზაცია', en: 'Display' },
    fields: ['showValue', 'thresholds'],
  },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'gauge': GaugeNode }
}
