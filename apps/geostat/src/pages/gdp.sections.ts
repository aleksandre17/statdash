import { codesOf }         from '@geostat/engine'
import { ASPECT }          from '@geostat/styles'
import { GDP_CLASSIFIERS } from '@/data/gdp/store'
import type { NodeDef }    from '@geostat/react/engine'

const _years = (codesOf(GDP_CLASSIFIERS.time) as number[]).slice().sort((a, b) => a - b)
const FIRST  = _years[0]
const LAST   = _years[_years.length - 1]

export const GDP_SECTIONS: NodeDef[] = [

  // ── Year mode: Production + Expenditure (2 columns) ───────────────────
  {
    type:  'columns',
    count: { default: 2, md: 1, sm: 1 },
    view:  { visibleWhen: { op: 'eq', param: 'mode', is: 'year' } },
    children: [

      {
        type:  'section',
        id:    'production',
        title: 'მთლიანი შიდა პროდუქტი წარმოების მეთოდით',
        color: '#0080BE',
        // Gap 7: node.vars — derived variable used in subtitle template
        vars:  { periodLabel: { op: 'template', tmpl: '{time} წ.' } },
        view:  { subtitle: '{periodLabel} · მლნ ₾' },
        // Gap 5: fieldConfig cascade — parent provides unit; chart children inherit
        fieldConfig: { unit: 'მლნ ₾' },
        data: {
          type:  'query',
          query: {
            measure: ['GDP_SVC', 'GDP_NET_TAX', 'GDP_IND', 'GDP_CON', 'GDP_AGRI', 'GDP'],
            filter:  { time: { $ctx: 'time' } },
          },
          pipe: [
            { op: 'derive', as: 'isTotal', expr: "measure == 'GDP' ? 1 : 0" },
            { op: 'lookup', key: 'measure', from: { $d: 'measure' }, fields: ['label', 'color'] },
            { op: 'derive', as: 'label',   expr: "isTotal == 1 ? 'მშპ სულ' : label" },
            { op: 'sort',   by: [{ field: 'isTotal', dir: 'asc' }, { field: 'value', dir: 'desc' }] },
          ],
          encoding: { label: 'label', value: 'value', color: 'color', pct: { of: 'GDP' }, isTotal: 'isTotal' },
        },
        children: [
          { type: 'wrap', styles: { aspectRatio: { default: ASPECT['16:9'], sm: ASPECT['4:3'] } }, children: [
            { type: 'chart', chartType: 'donut',  label: 'სექტორული სტრუქტურა — % მშპ-დან', centerLabel: 'მშპ', view: { role: 'chart', label: 'დიაგრამა' } },
            { type: 'table', colLabel: 'სექტორი', columns: [{ key: 'value', label: 'მლნ ₾' }, { key: 'pct', label: 'წილი', format: 'pct', bar: { max: 100 } }], color: '#0080BE',
              // Gap 4: transforms — alphabetical sort on the table view
              transforms: [{ op: 'sort', by: 'label', dir: 'asc' }],
              view: { role: 'table', label: 'ცხრილი' } },
          ]},
        ],
      },

      {
        type:  'section',
        id:    'expenditure',
        title: 'მთლიანი შიდა პროდუქტი დანახარჯების მეთოდით',
        color: '#00A896',
        // Gap 5: fieldConfig cascade — parent provides unit; chart children inherit
        fieldConfig: { unit: 'მლნ ₾' },
        view:  { subtitle: '{time} · მლნ ₾' },
        data: {
          type:  'query',
          query: {
            measure: ['C', 'I_GFCF', 'X', 'M', 'GDP'],
            filter:  { time: { $ctx: 'time' } },
          },
          pipe: [
            { op: 'derive', as: 'value',   expr: "measure == 'M' ? value * -1 : value" },
            { op: 'derive', as: 'isTotal', expr: "measure == 'GDP' ? 1 : 0" },
            { op: 'lookup', key: 'measure', from: { $d: 'measure' }, fields: ['label', 'color'] },
            { op: 'derive', as: 'label',   expr: "isTotal == 1 ? 'მშპ' : label" },
            { op: 'derive', as: 'color',   expr: "isTotal == 1 ? '#E53E3E' : '#0080BE'" },
            { op: 'sort',   by: [{ field: 'measure', using: ['C', 'I_GFCF', 'X', 'M', 'GDP'] }] },
          ],
          encoding: { label: 'label', value: 'value', color: 'color', isTotal: 'isTotal' },
        },
        children: [
          { type: 'wrap', styles: { aspectRatio: { default: ASPECT['16:9'], sm: ASPECT['4:3'] } }, children: [
            { type: 'chart', chartType: 'contribution', label: 'C + I + X − M = მშპ', view: { role: 'chart', label: 'დიაგრამა' } },
            { type: 'table', valueLabel: 'მლნ ₾', color: '#00A896', view: { role: 'table', label: 'ცხრილი' } },
          ]},
        ],
      },

    ],
  },

  // ── Range mode: Production trend + Per capita (2 columns) ─────────────
  {
    type:  'columns',
    count: { default: 2, md: 1, sm: 1 },
    view:       { visibleWhen: { op: 'eq', param: 'mode', is: 'range' } },
    children: [

      {
        type:  'section',
        id:    'production-range',
        title: 'მთლიანი შიდა პროდუქტი წარმოების მეთოდით',
        color: '#0080BE',
        view:  { styles: { height: '16:9' }, subtitle: `${FIRST}–${LAST} · მლნ ₾` },
        data: {
          type:  'query',
          query: { measure: 'GDP' },
          pipe: [
            { op: 'sort', by: 'time', dir: 'asc' },
          ],
          encoding: { label: 'time', value: 'value', pct: { sumOf: 'value' } },
          fromDim: 'fromYear', toDim: 'toYear',
        },
        children: [
          { type: 'chart', chartType: 'combo', label: 'მშპ ისტორიული დინამიკა', fieldConfig: { unit: 'მლნ ₾' }, view: { role: 'chart', label: 'დიაგრამა' } },
          { type: 'table', colLabel: 'წელი', columns: [{ key: 'value', label: 'მლნ ₾', bar: true }], color: '#0080BE',
            // Gap 4: transforms — sort years ascending in the table view
            transforms: [{ op: 'sort', by: 'label', dir: 'asc' }],
            view: { role: 'table', label: 'ცხრილი' } },
        ],
      },

      {
        type:  'section',
        id:    'income-range',
        title: 'მთლიანი შიდა პროდუქტი ერთ სულ მოსახლეზე',
        color: '#7B6CF6',
        view:  { styles: { height: '16:9' }, subtitle: `${FIRST}–${LAST} · $` },
        data: {
          type:  'query',
          query: { measure: 'GDP_PER_CAPITA' },
          pipe: [
            { op: 'sort', by: 'time', dir: 'asc' },
          ],
          encoding: { label: 'time', value: 'value', pct: { sumOf: 'value' } },
          fromDim: 'fromYear', toDim: 'toYear',
        },
        children: [
          { type: 'chart', chartType: 'line', label: 'ერთ სულ მოსახლეზე — ტრენდი', fieldConfig: { unit: '$' }, view: { role: 'chart', label: 'დიაგრამა' } },
          { type: 'table', colLabel: 'წელი', columns: [{ key: 'value', label: '$', format: 'mln_gel', bar: true }], color: '#7B6CF6', view: { role: 'table', label: 'ცხრილი' } },
        ],
      },

    ],
  },

  // ── Year mode: Income account + GFCF structure (2 columns) ────────────
  {
    type:  'columns',
    count: { default: 2, md: 1, sm: 1 },
    view:  { visibleWhen: { op: 'eq', param: 'mode', is: 'year' } },
    children: [

      {
        type:  'section',
        id:    'income',
        title: 'შემოსავლების ფორმირების ანგარიში',
        color: '#7B6CF6',
        view:  { subtitle: '{time} · მლნ ₾' },
        data: {
          type:  'query',
          query: {
            measure: ['OS_GROSS', 'D1', 'MIXED_INC', 'NET_TAX_PROD', 'GDP'],
            filter:  { time: { $ctx: 'time' } },
          },
          pipe: [
            { op: 'derive', as: 'isTotal',      expr: "measure == 'GDP' ? 1 : 0" },
            { op: 'lookup', key: 'measure',      from: { $d: 'measure' }, fields: ['fullLabel'] },
            { op: 'derive', as: 'prefix',        expr: "isTotal == 1 ? '(=) ' : '(+) '" },
            { op: 'concat', fields: ['prefix', 'fullLabel'], as: 'prefixedLabel', sep: '' },
            { op: 'sort',   by: [{ field: 'isTotal', last: 1 }, { field: 'value', dir: 'desc' }] },
          ],
          encoding: { label: 'prefixedLabel', value: 'value', isTotal: 'isTotal', pct: { of: 'GDP' } },
        },
        children: [
          { type: 'wrap', styles: { aspectRatio: { default: ASPECT['16:9'], sm: ASPECT['4:3'] } }, children: [
            { type: 'chart', chartType: 'treemap', label: 'შემოსავლების სტრუქტურა', fieldConfig: { unit: 'მლნ ₾' }, view: { role: 'chart', label: 'დიაგრამა' } },
            { type: 'table', valueLabel: 'მლნ ₾', color: '#7B6CF6', view: { role: 'table', label: 'ცხრილი' } },
          ]},
        ],
      },

      {
        type:  'section',
        id:    'structural',
        title: 'მთლიანი კაპიტალის ფორმირების სტრუქტურა, %',
        color: '#F4A261',
        view:  { subtitle: '{time}' },
        data: {
          type: 'ratio-list',
          pairs: [
            { code: 'GFCF_RES',    denom: 'I_GFCF' },
            { code: 'GFCF_STRUCT', denom: 'I_GFCF' },
            { code: 'GFCF_MACH',   denom: 'I_GFCF' },
            { code: 'GFCF_BIO',    denom: 'I_GFCF' },
            { code: 'GFCF_IP',     denom: 'I_GFCF' },
          ],
          pipe: [
            { op: 'lookup', key: 'measure', from: { $d: 'measure' }, fields: ['label', 'color'] },
            { op: 'sort',   by: 'value', dir: 'desc' },
          ],
        },
        children: [
          { type: 'wrap', styles: { aspectRatio: { default: ASPECT['16:9'], sm: ASPECT['4:3'] } }, children: [
            { type: 'chart', chartType: 'donut', label: 'GFCF სტრუქტურა — % GFCF-სგან', fieldConfig: { unit: '%', decimals: 1 }, view: { role: 'chart', label: 'დიაგრამა' } },
            { type: 'table', columns: [{ key: 'value', label: '% GFCF-ისგ.', format: 'pct' }], color: '#F4A261', view: { role: 'table', label: 'ცხრილი' } },
          ]},
        ],
      },

    ],
  },

  // ── Range mode: Growth dynamics + NOE share (2 columns) ───────────────
  {
    type:  'columns',
    count: { default: 2, md: 1, sm: 1 },
    view:       { visibleWhen: { op: 'eq', param: 'mode', is: 'range' } },
    children: [

      {
        type:  'section',
        id:    'growth-dynamics',
        title: 'რეალური მთლიანი შიდა პროდუქტის ზრდა',
        color: '#E76F51',
        view:  { styles: { height: '16:9' }, subtitle: `${FIRST}–${LAST} · %` },
        data: {
          type:  'query',
          query: { measure: 'GDP_GROWTH' },
          pipe: [
            { op: 'sort', by: 'time', dir: 'asc' },
          ],
          encoding: { label: 'time', value: 'value' },
          fromDim: 'fromYear', toDim: 'toYear',
        },
        children: [
          { type: 'chart', chartType: 'bar', label: 'მშპ წლიური ზრდის ტემპები', fieldConfig: { unit: '%', decimals: 1 }, axes: { y: { decimals: 1 } }, view: { role: 'chart', label: 'დიაგრამა' } },
          { type: 'table', colLabel: 'წელი', columns: [{ key: 'value', label: '%', format: 'sign_pct' }], color: '#E76F51', view: { role: 'table', label: 'ცხრილი' } },
        ],
      },

      {
        type:  'section',
        id:    'noe-share',
        title: 'დაუკვირვებადი დამატებული ღირებულების წილი მთლიან დამატებულ ღირებულებაში',
        color: '#6B7B8D',
        view:  { styles: { height: '16:9' }, subtitle: `${FIRST}–${LAST} · % · მიმდინარე ფასებში` },
        data: {
          type:  'query',
          query: { measure: 'NOE_SHARE' },
          pipe: [
            { op: 'sort', by: 'time', dir: 'asc' },
          ],
          encoding: { label: 'time', value: 'value' },
          fromDim: 'fromYear', toDim: 'toYear',
        },
        children: [
          { type: 'chart', chartType: 'bar', label: 'დაუკვირვებადი ეკონომიკის წილი, %', fieldConfig: { unit: '%', decimals: 1 }, axes: { y: { decimals: 1 } }, view: { role: 'chart', label: 'დიაგრამა' } },
          { type: 'table', colLabel: 'წელი', columns: [{ key: 'value', label: '%', format: 'pct' }], color: '#6B7B8D', view: { role: 'table', label: 'ცხრილი' } },
        ],
      },

    ],
  },

]