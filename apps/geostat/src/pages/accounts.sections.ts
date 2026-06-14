import type { NodeDef } from '@geostat/react/engine'

export const ACCOUNTS_SECTIONS: NodeDef[] = [

  // ── 0a. Hero — year: SNA T-account diverging chain ─────────────────
  {
    type:  'section',
    id:    'sna-hero',
    title: 'ეროვნული ანგარიშები',
    color: '#0080BE',
    view:  { hero: true, noCollapse: true, subtitle: '{time} · მლნ ₾', visibleWhen: { op: 'eq', param: 'mode', is: 'year' }, styles: { height: '16:9' } },
    children: [
      {
        type: 'chart', chartType: 'hbar-diverging', compact: true,
        label: 'ანგარიშების სრული ჯაჭვი · მლნ ₾',
        fieldConfig: { unit: 'მლნ ₾' },
        view: { role: 'chart', label: 'დიაგრამა' },
        data: {
          type:  'query',
          query: {
            measure: '*',
            filter: {
              time:    { $ctx: 'time'    },
              account: { $ctx: 'account' },
              measure: { $ctx: 'measure' },
            },
          },
          pipe: [
            { op: 'join', with: { $cl: 'account'     }, on: 'account', fields: ['order']     },
            { op: 'join', with: { $cl: 'aggregates' }, on: 'measure', fields: ['isClosing'] },
            { op: 'sort', by: [
              { field: 'order',     dir:  'asc'        },
              { field: 'side',      using: ['R', 'U']  },
              { field: 'seqPos',    dir:  'asc', last: -1 },
              { field: 'isClosing', dir:  'asc'        },
            ] },
            { op: 'lookup', key: 'measure', from: { $d: 'aggregates' }, fields: ['label', 'color'] },
            { op: 'lookup', key: 'account', from: { $d: 'account'     }, fields: ['label', 'color'],
              rename: { label: 'accountLabel', color: 'accountColor' } },
            { op: 'lookup', key: 'side',
              from: { R: { series: 'რესურსები', color: '#4472C4' },
                      U: { series: 'გამოყენება',      color: '#E76F51' } },
              fields: ['series', 'color'] },
            { op: 'template', as: 'label', tpl: '{label} ({measure})' },
            { op: 'concat', fields: ['account', 'measure', 'side'], as: '_id' },
            { op: 'rename', fields: { isClosing: '_isTotal' } },
            { op: 'group',
              by: [{ field: 'account',
                      inject: {
                        from: { label: 'accountLabel', color: 'accountColor' },
                        set:  { _isGroup: 1, series: 'რესურსები', value: 0 },
                      } }] },
          ],
          encoding: {
            label:       'label',
            series:      'series',
            color:       'color',
            id:          '_id',
            isSeparator: '_isGroup',
            isTotal:     '_isTotal',
            level:       '_level',
            parentId:    '_parentId',
          },
        },
      },
      {
        type: 'table',
        columns: [{ key: 'value', label: 'მლნ ₾', format: 'mln_gel', bar: true }],
        color: '#0080BE', indent: true, statusFlags: false,
        view: { role: 'table', label: 'ცხრილი' },
        data: {
          type:  'query',
          query: {
            measure: '*',
            filter: {
              time:    { $ctx: 'time'    },
              account: { $ctx: 'account' },
              measure: { $ctx: 'measure' },
            },
          },
          pipe: [
            { op: 'join', with: { $cl: 'account'     }, on: 'account', fields: ['order']     },
            { op: 'join', with: { $cl: 'aggregates' }, on: 'measure', fields: ['isClosing'] },
            { op: 'sort', by: [
              { field: 'order',     dir:  'asc'        },
              { field: 'side',      using: ['R', 'U']  },
              { field: 'seqPos',    dir:  'asc', last: -1 },
              { field: 'isClosing', dir:  'asc'        },
            ] },
            { op: 'lookup', key: 'measure', from: { $d: 'aggregates' }, fields: ['label', 'color'] },
            { op: 'lookup', key: 'account', from: { $d: 'account'     }, fields: ['label', 'color'],
              rename: { label: 'accountLabel', color: 'accountColor' } },
            { op: 'lookup', key: 'side',
              from: { R: { series: 'რესურსები', color: '#4472C4' },
                      U: { series: 'გამოყენება',      color: '#E76F51' } },
              fields: ['series', 'color'] },
            { op: 'template', as: 'label', tpl: '{label} ({measure})' },
            { op: 'concat', fields: ['account', 'measure', 'side'], as: '_id' },
            { op: 'rename', fields: { isClosing: '_isTotal' } },
            { op: 'group',
              by: [{ field: 'account',
                      inject: {
                        from: { label: 'accountLabel', color: 'accountColor' },
                        set:  { _isGroup: 1, series: 'რესურსები', value: 0 },
                      } }] },
          ],
          encoding: {
            label:       'label',
            series:      'series',
            color:       'color',
            id:          '_id',
            isSeparator: '_isGroup',
            isTotal:     '_isTotal',
            level:       '_level',
            parentId:    '_parentId',
          },
        },
      },
    ],
  },

  // ── 1. All-accounts overview — Repeat pattern (year mode only) ─────────
  //
  //  RepeatShell iterates `each` and renders the child SectionNode once per
  //  account, injecting per-item vars (account_label, account_code, account_color)
  //  and overriding ctx.sectionCtx.dims.account = item.code so that
  //  { $ctx: 'account' } in child DataSpecs resolves to each account independently.
  //
  {
    type: 'repeat',
    as:   'account',
    view: { visibleWhen: { op: 'eq', param: 'mode', is: 'year' } },
    each: [
      { code: 'production', label: 'წარმოების ანგარიში',    color: '#0080BE' },
      { code: 'income_gen', label: 'შემოსავლის ფორმირება', color: '#E76F51' },
      { code: 'capital',    label: 'კაპიტალის ანგარიში',   color: '#4472C4' },
    ],
    children: [
      {
        type:  'section',
        id:    'account-{account_code}',
        title: '{account_label}',
        view:  { subtitle: '{time} · მლნ ₾', toggle: true },
        children: [
          {
            type: 'chart', chartType: 'hbar-diverging', compact: true,
            label: 'T-ანგარიში · მლნ ₾',
            view: { role: 'chart', label: 'დიაგრამა' },
            fieldConfig: { unit: 'მლნ ₾' },
            data: {
              type:  'query',
              query: {
                measure: '*',
                filter:  { time: { $ctx: 'time' }, account: { $ctx: 'account' } },
              },
              pipe: [
                { op: 'join',   with: { $cl: 'aggregates' }, on: 'measure', fields: ['isClosing'] },
                { op: 'sort',   by: [
                  { field: 'side',      using: ['R', 'U']  },
                  { field: 'seqPos',    dir:  'asc', last: -1 },
                  { field: 'isClosing', dir:  'asc'        },
                ] },
                { op: 'lookup', key: 'measure', from: { $d: 'aggregates' }, fields: ['label', 'color'] },
                { op: 'lookup', key: 'side',
                  from: { R: { series: 'რესურსები', color: '#4472C4' },
                          U: { series: 'გამოყენება', color: '#E76F51' } },
                  fields: ['series', 'color'] },
                { op: 'template', as: 'label', tpl: '{label} ({measure})' },
                { op: 'concat',   fields: ['measure', 'side'], as: '_id' },
                { op: 'rename',   fields: { isClosing: '_isTotal' } },
              ],
              encoding: {
                label:   'label',
                series:  'series',
                color:   'color',
                id:      '_id',
                isTotal: '_isTotal',
              },
            },
          },
          {
            type: 'table',
            columns: [{ key: 'value', label: 'მლნ ₾', format: 'mln_gel', bar: true }],
            indent: true, statusFlags: false,
            view:   { role: 'table', label: 'ცხრილი' },
            data: {
              type:  'query',
              query: {
                measure: '*',
                filter:  { time: { $ctx: 'time' }, account: { $ctx: 'account' } },
              },
              pipe: [
                { op: 'join',   with: { $cl: 'aggregates' }, on: 'measure', fields: ['isClosing'] },
                { op: 'sort',   by: [
                  { field: 'side',      using: ['R', 'U']  },
                  { field: 'seqPos',    dir:  'asc', last: -1 },
                  { field: 'isClosing', dir:  'asc'        },
                ] },
                { op: 'lookup', key: 'measure', from: { $d: 'aggregates' }, fields: ['label', 'color'] },
                { op: 'lookup', key: 'side',
                  from: { R: { series: 'რესურსები', color: '#4472C4' },
                          U: { series: 'გამოყენება', color: '#E76F51' } },
                  fields: ['series', 'color'] },
                { op: 'template', as: 'label', tpl: '{label} ({measure})' },
                { op: 'concat',   fields: ['measure', 'side'], as: '_id' },
                { op: 'rename',   fields: { isClosing: '_isTotal' } },
              ],
              encoding: {
                label:   'label',
                series:  'series',
                color:   'color',
                id:      '_id',
                isTotal: '_isTotal',
              },
            },
          },
        ],
      },
    ],
  },

  // ── 0b. Hero — range: SNA historical combo ──────────────────────────
  {
    type:  'section',
    id:    'sna-hero-range',
    title: 'ეროვნული ანგარიშები',
    color: '#0080BE',
    view:  { hero: true, noCollapse: true, subtitle: '2020–2025 · მლნ ₾', visibleWhen: { op: 'eq', param: 'mode', is: 'range' }, styles: { height: '16:9' } },
    children: [
      {
        type: 'chart', chartType: 'bar', stacked: true,
        label: 'P1 · B1G · B5G · B6G · B8G · B9 — სრული ჯაჭვი',
        view: { role: 'chart', label: 'დიაგრამა' },
        fieldConfig: { unit: 'მლნ ₾' },
        data: {
          type:  'query',
          query: {
            measure: ['P1', 'B1G', 'B5G', 'B6G', 'B8G', 'B9'],
            orderBy: { field: 'time', dir: 'asc' },
          },
          pipe: [
            { op: 'derive', as: 'isCarryForward', expr: "side == 'R' && seqPos > 0 ? 1 : 0" },
            { op: 'filter', where: { isCarryForward: 0 } },
            { op: 'lookup', key: 'measure', from: { $d: 'aggregates' }, fields: ['label', 'color'] },
          ],
          encoding: { label: 'time', series: 'label', color: 'color' },
          fromDim: 'fromYear', toDim: 'toYear',
        },
      },
      {
        type: 'table',
        colLabel: 'წელი',
        columns: [{ key: 'value', label: 'მლნ ₾', format: 'mln_gel' }],
        color: '#0080BE', indent: true, statusFlags: false,
        view: { role: 'table', label: 'ცხრილი' },
        data: {
          type:  'query',
          query: {
            measure: ['P1', 'B1G', 'B5G', 'B6G', 'B8G', 'B9'],
            orderBy: { field: 'time', dir: 'asc' },
          },
          pipe: [
            { op: 'derive', as: 'isCarryForward', expr: "side == 'R' && seqPos > 0 ? 1 : 0" },
            { op: 'filter', where: { isCarryForward: 0 } },
            { op: 'lookup', key: 'measure', from: { $d: 'aggregates' }, fields: ['label', 'color'] },
          ],
          encoding: { label: 'time', series: 'label', color: 'color' },
          fromDim: 'fromYear', toDim: 'toYear',
        },
      },
    ],
  },

]