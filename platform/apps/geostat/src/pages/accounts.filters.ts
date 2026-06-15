import type { FilterSchemaInput } from '@geostat/engine'

export const ACCOUNTS_FILTER_SCHEMA: FilterSchemaInput = {
  context: {
    timeMode: 'mode',
    dims: { time: 'year', fromYear: 'fromYear', toYear: 'toYear', account: 'account', measure: 'measure' },
  },
  effects: [
    { when: { mode: 'range' },          set: { account: '', measure: '' } },
    { when: { mode: { neq: 'range' } }, set: { fromYear: '', toYear: '' } },
  ],
  bars: {
    'year-bar': {
      position: 'sticky',
      order:    0,
      showWhen: { mode: { neq: 'range' } },
      filters: {
        mode:    { type: 'hidden', default: 'year' },
        measure: { type: 'hidden', default: ''     },
        account: {
          type:       'select',
          label:      'ანგარიში:',
          default:    '',
          emptyLabel: 'ყველა',
          options: {
            type:       'inline',
            items:      { $d: 'account' },
            pipe:       [{ op: 'sort', by: 'order', dir: 'asc' }],
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
        mode:    { type: 'hidden', default: 'year' },
        account: { type: 'hidden', default: ''     },
        measure: { type: 'hidden', default: ''     },
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