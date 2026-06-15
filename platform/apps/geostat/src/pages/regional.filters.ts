import type { FilterSchemaInput } from '@geostat/engine'

export const REGIONAL_FILTER_SCHEMA: FilterSchemaInput = {
  context: {
    timeMode: 'mode',
    dims:     { time: 'year', geo: 'region', sector: 'sector', fromYear: 'fromYear', toYear: 'toYear', geos: 'geos' },
  },
  effects: [
    { when: { mode: 'range' },          set: { year: '', sector: '_T' } },
    { when: { mode: { neq: 'range' } }, set: { fromYear: '', toYear: '' } },
  ],
  bars: {
    'year-bar': {
      position: 'sticky',
      order:    0,
      showWhen: { mode: { neq: 'range' } },
      filters: {
        mode:   { type: 'hidden', default: 'year'  },
        region: { type: 'hidden', default: 'total' },
        sector: {
          type:       'select',
          label:      'სექტორი:',
          default:    '_T',
          emptyLabel: 'ყველა',
          options: {
            type:       'inline',
            items:      { $d: 'sector' },
            pipe:       [{ op: 'filter', where: { code: { $ne: '_T' } } }, { op: 'sort', by: 'label', dir: 'asc' }],
            valueField: 'code',
            labelField: 'label',
          },
        },
        year: {
          type:    'year-select',
          default: { from: 'options', pick: 'last' },
          years:   { type: 'inline', items: { $cl: 'time' }, field: 'code' },
        },
      },
    },
    'range-bar': {
      position: 'sticky',
      order:    0,
      showWhen: { mode: 'range' },
      filters: {
        mode:   { type: 'hidden', default: 'year'  },
        region: { type: 'hidden', default: 'total' },
        sector: { type: 'hidden', default: '_T'    },
        fromYear: {
          type:    'select',
          label:   'შუალედი:',
          suffix:  '-დან',
          default: { from: 'options', pick: 'first' },
          options: {
            type:       'inline',
            items:      { $d: 'time' },
            pipe:       [{ op: 'sort', by: 'code', dir: 'asc' }],
            valueField: 'code',
            labelField: 'code',
          },
        },
        toYear: {
          type:    'select',
          suffix:  '-მდე',
          default: { from: 'options', pick: 'last' },
          options: {
            type:       'inline',
            items:      { $d: 'time' },
            pipe:       [{ op: 'sort', by: 'code', dir: 'desc' }],
            valueField: 'code',
            labelField: 'code',
          },
        },
      },
    },
  },
}