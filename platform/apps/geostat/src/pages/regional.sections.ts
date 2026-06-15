import { ASPECT }             from '@geostat/styles'
import type { GeorgraphNode } from '@plugins/nodes/georgraph/default/GeorgraphNode'
import type { NodeDef }       from '@geostat/react/engine'

export const REGIONAL_SECTIONS: NodeDef[] = [

  // ── Year mode: Map + sectors (2 columns) ──────────────────────────────
  {
    type:  'columns',
    count: { default: 2, md: 1, sm: 1 },
    view:       { visibleWhen: { op: 'eq', param: 'mode', is: 'year' } },
    children: [

      {
        type:       'georgraph',
        id:         'geo-map',
        title:      'მთლიანი შიდა პროდუქტი — რეგიონების მიხედვით',
        label:      '{_regionTitle}',
        color:      '#0080BE',
        data: {
          type:  'query',
          query: { measure: 'GVA', filter: { time: { $ctx: 'time' }, sector: { $ctx: 'sector' } } },
          pipe: [
            { op: 'aggregate', by: ['geo', 'time'], measure: 'value', agg: 'sum' },
            { op: 'lookup',    key: 'geo', from: { $d: 'geo' }, fields: ['label', 'color'] },
            { op: 'sort',      by: 'value', dir: 'desc' },
          ],
          encoding: { id: 'geo', label: 'label', value: 'value', color: 'color', pct: { sumOf: 'value' } },
        },
        children: [
          { type: 'table', colLabel: 'რეგიონი', columns: [{ key: 'value', label: 'მლნ ₾' }, { key: 'pct', label: 'წილი', format: 'pct', bar: { max: 100 } }], footer: { value: 'sum' }, color: '#0080BE', view: { role: 'table', label: 'ცხრილი' } },
        ],
        view:         { styles: { height: '16:9' } },
        geoJsonUrl:   '/data/georgia-regions.geojson',
        paramKey:     'region',
        isoField:     'shapeISO',
        multiSelect:  true,
        maxSelect:    10,
        geoCodeMap: {
          'GE-TB': 'tbilisi',  'GE-AJ': 'adjara',    'GE-GU': 'guria',
          'GE-IM': 'imereti',  'GE-KA': 'kakheti',   'GE-MM': 'mtskheta',
          'GE-RL': 'racha',    'GE-SZ': 'samegrelo', 'GE-SJ': 'samtskhe',
          'GE-KK': 'kvemo_kartli', 'GE-SK': 'shida_kartli',
        },
        labelOverrides: {
          'GE-AB': 'ოკუპირებული ტერიტორია',
          'GE-OS': 'ოკუპირებული ტერიტორია',
        },
      } satisfies GeorgraphNode,

      // Single-region: sector donut
      {
        type:  'section',
        id:    'sectors',
        title: 'მთლიანი შიდა პროდუქტი სექტორების მიხედვით',
        label: '{_regionTitle}',
        color: '#0080BE',
        view:  { styles: { height: '16:9' }, subtitle: '{time} · მლნ ₾', legend: 'none', visibleWhen: { op: 'eq', param: '_geoMode', is: 'single' } },
        data: {
          type:  'query',
          query: { measure: 'GVA', filter: { time: { $ctx: 'time' }, geo: { $ctx: 'geo' } } },
          pipe: [
            { op: 'aggregate', by: ['sector', 'time'], measure: 'value', agg: 'sum' },
            { op: 'rollup',    dim: 'sector', as: '__total__', of: '*', agg: 'sum' },
            { op: 'derive',    as: 'isTotal', expr: "sector == '__total__' ? 1 : 0" },
            { op: 'lookup',    key: 'sector', from: { $d: 'sector' }, fields: ['label', 'color', 'fullLabel'] },
            { op: 'derive',    as: 'label',   expr: "isTotal == 1 ? 'სულ' : label" },
            { op: 'sort',      by: [{ field: 'isTotal', dir: 'asc' }, { field: 'value', dir: 'desc' }] },
          ],
          encoding: { label: 'label', value: 'value', color: 'color', pct: { sumOf: 'value' }, isTotal: 'isTotal' },
        },
        children: [
          { type: 'chart', chartType: 'donut', label: 'სექტორული სტრუქტურა — % დამატებული ღირებულებიდან', fieldConfig: { unit: 'მლნ ₾' }, centerLabel: 'მშპ', view: { role: 'chart', label: 'დიაგრამა' } },
          { type: 'table', colLabel: 'სექტორი', columns: [{ key: 'value', label: 'მლნ ₾' }, { key: 'pct', label: 'წილი', format: 'pct', bar: { max: 100 } }], color: '#0080BE', view: { role: 'table', label: 'ცხრილი' } },
        ],
      },

      // Multi-region: grouped bar
      {
        type:  'section',
        id:    'sectors-multi',
        title: 'სექტორული სტრუქტურა — რეგიონული შედარება',
        label: '{_regionTitle}',
        color: '#0080BE',
        view:  { styles: { height: '16:9' }, subtitle: '{time} · მლნ ₾', visibleWhen: { op: 'eq', param: '_geoMode', is: 'multi' } },
        data: {
          type:  'query',
          query: { measure: 'GVA', filter: { time: { $ctx: 'time' }, geo: { $ctx: 'geo' } } },
          pipe: [
            { op: 'aggregate', by: ['sector', 'geo', 'time'], measure: 'value', agg: 'sum' },
            { op: 'lookup',    key: 'sector', from: { $d: 'sector' }, fields: ['label', 'sectorOrder'] },
            { op: 'derive',    as: 'sectorLabel', expr: 'label' },
            { op: 'lookup',    key: 'geo', from: { $d: 'geo' }, fields: ['label', 'color'] },
            { op: 'sort',      by: 'sectorOrder', dir: 'asc' },
          ],
          encoding: { label: 'sectorLabel', value: 'value', series: 'label', color: 'color' },
        },
        children: [
          { type: 'chart', chartType: 'bar', stacked: true, label: 'სექტორული სტრუქტურა — რეგიონული შედარება', fieldConfig: { unit: 'მლნ ₾' }, view: { role: 'chart', label: 'დიაგრამა' } },
          { type: 'table', colLabel: 'სექტორი', columns: [{ key: 'value', label: 'მლნ ₾' }], color: '#0080BE', view: { role: 'table', label: 'ცხრილი' } },
        ],
      },

    ],
  },

  // ── Year mode: Regional comparison bar (full width) ───────────────────
  {
    type:  'section',
    id:    'regions-bar',
    title: 'მთლიანი შიდა პროდუქტი — რეგიონული შედარება',
    color: '#0080BE',
    view:  { subtitle: '{time} · მლნ ₾', visibleWhen: { op: 'eq', param: 'mode', is: 'year' } },
    data: {
      type:  'query',
      query: { measure: 'GVA', filter: { time: { $ctx: 'time' }, sector: { $ctx: 'sector' }, geo: { $ctx: 'geo' } } },
      pipe: [
        { op: 'aggregate', by: ['geo', 'time'], measure: 'value', agg: 'sum' },
        { op: 'lookup',    key: 'geo', from: { $d: 'geo' }, fields: ['label', 'color'] },
        { op: 'sort',      by: 'value', dir: 'desc' },
      ],
      // id: 'geo' exposes the geo code as DataRow.id — used by DataLinks for navigation
      encoding: { id: 'geo', label: 'label', value: 'value', color: 'color', pct: { sumOf: 'value' } },
    },
    children: [
      {
        type: 'chart', chartType: 'hbar', label: 'მთლიანი დამატებული ღირებულება — რეგიონების მიხედვით',
        fieldConfig: { unit: 'მლნ ₾' },
        // Gap 8: DataLinks — click on a region bar to navigate to regional detail page
        dataLinks: [
          {
            title:  { ka: 'რეგიონის დეტალები', en: 'Region details' },
            target: 'page',
            page:   '/regional',
            params: { region: { $row: 'id' } },
          },
        ],
        view: { styles: { aspectRatio: { default: ASPECT['16:9'], sm: ASPECT['4:3'] } }, role: 'chart', label: 'დიაგრამა' },
      },
      { type: 'table', colLabel: 'რეგიონი', columns: [{ key: 'value', label: 'მლნ ₾' }, { key: 'pct', label: 'წილი', format: 'pct', bar: { max: 100 } }], footer: { value: 'sum' }, color: '#0080BE', view: { styles: { aspectRatio: { default: ASPECT['16:9'], sm: ASPECT['4:3'] } }, role: 'table', label: 'ცხრილი' } },
    ],
  },

  // ── Range mode: Map snapshot + GVA dynamics (2 columns) ───────────────
  {
    type:  'columns',
    count: { default: 2, md: 1, sm: 1 },
    view:       { visibleWhen: { op: 'eq', param: 'mode', is: 'range' } },
    children: [

      {
        type:       'georgraph',
        id:         'geo-map-range',
        title:      'მთლიანი შიდა პროდუქტი — რეგიონების მიხედვით',
        label:      '{_regionTitle}',
        color:      '#0080BE',
        data: {
          type:  'query',
          query: { measure: 'GVA', filter: { time: { $ctx: 'toYear' }, sector: { $ctx: 'sector' } } },
          pipe: [
            { op: 'aggregate', by: ['geo', 'time'], measure: 'value', agg: 'sum' },
            { op: 'lookup',    key: 'geo', from: { $d: 'geo' }, fields: ['label', 'color'] },
            { op: 'sort',      by: 'value', dir: 'desc' },
          ],
          encoding: { id: 'geo', label: 'label', value: 'value', color: 'color', pct: { sumOf: 'value' } },
        },
        children: [
          { type: 'table', colLabel: 'რეგიონი', columns: [{ key: 'value', label: 'მლნ ₾' }, { key: 'pct', label: 'წილი', format: 'pct', bar: { max: 100 } }], footer: { value: 'sum' }, color: '#0080BE', view: { role: 'table', label: 'ცხრილი' } },
        ],
        view:      { styles: { height: '16:9' } },
        geoJsonUrl: '/data/georgia-regions.geojson',
        paramKey:   'region',
        isoField:   'shapeISO',
        geoCodeMap: {
          'GE-TB': 'tbilisi',  'GE-AJ': 'adjara',    'GE-GU': 'guria',
          'GE-IM': 'imereti',  'GE-KA': 'kakheti',   'GE-MM': 'mtskheta',
          'GE-RL': 'racha',    'GE-SZ': 'samegrelo', 'GE-SJ': 'samtskhe',
          'GE-KK': 'kvemo_kartli', 'GE-SK': 'shida_kartli',
        },
        labelOverrides: {
          'GE-AB': 'ოკუპირებული ტერიტორია',
          'GE-OS': 'ოკუპირებული ტერიტორია',
        },
      } satisfies GeorgraphNode,

      {
        type:  'section',
        id:    'sectors-range',
        title: 'მთლიანი შიდა პროდუქტის წლიური დინამიკა',
        color: '#0080BE',
        view:  { subtitle: '{fromYear}–{toYear} · მლნ ₾', styles: { height: '16:9' } },
        data: {
          type:  'query',
          query: { measure: 'GVA', filter: { sector: { $ctx: 'sector' }, geo: { $ctx: 'geo' } } },
          pipe: [
            { op: 'aggregate', by: ['time'], measure: 'value', agg: 'sum' },
            { op: 'sort',      by: 'time', dir: 'asc' },
          ],
          encoding: { label: 'time', value: 'value' },
          fromDim: 'fromYear', toDim: 'toYear',
        },
        children: [
          { type: 'chart', chartType: 'bar', label: 'მთლიანი შიდა პროდუქტის დინამიკა, {fromYear}–{toYear}', fieldConfig: { unit: 'მლნ ₾' }, dataLabels: false, view: { role: 'chart', label: 'დიაგრამა' } },
          { type: 'table', colLabel: 'წელი', columns: [{ key: 'value', label: 'მლნ ₾' }], footer: { value: 'avg' }, color: '#0080BE', view: { role: 'table', label: 'ცხრილი' } },
        ],
      },

    ],
  },

  // ── Range mode: Sector history — full width ───────────────────────────
  {
    type:  'section',
    id:    'sector-history',
    title: 'სექტორული სტრუქტურა — ისტორიული დინამიკა',
    color: '#7B6CF6',
    view:  { styles: { height: '16:9' }, subtitle: '{fromYear}–{toYear} · მლნ ₾', visibleWhen: { op: 'eq', param: 'mode', is: 'range' } },
    data: {
      type:  'query',
      query: { measure: 'GVA', filter: { sector: { $ctx: 'sector' }, geo: { $ctx: 'geo' } } },
      pipe: [
        { op: 'aggregate', by: ['sector', 'time'], measure: 'value', agg: 'sum' },
        { op: 'lookup',    key: 'sector', from: { $d: 'sector' }, fields: ['label', 'color'] },
        { op: 'sort',      by: 'time', dir: 'asc' },
      ],
      encoding: { label: 'time', value: 'value', color: 'color', series: 'label' },
      fromDim: 'fromYear', toDim: 'toYear',
    },
    children: [
      { type: 'chart', chartType: 'area', stacked: true, label: 'სექტორული მთლიანი დამატებული ღირებულება — ისტორიული ტრენდი', fieldConfig: { unit: 'მლნ ₾' }, view: { role: 'chart', label: 'დიაგრამა' } },
      { type: 'table', colLabel: 'წელი', valueLabel: 'მლნ ₾', footer: { value: 'avg' }, color: '#7B6CF6', view: { role: 'table', label: 'ცხრილი' } },
    ],
  },

]