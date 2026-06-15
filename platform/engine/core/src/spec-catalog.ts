// ── @geostat/engine — Spec capability catalog ─────────────────────────────────
// Consumed by Panel's DataSpec type picker. NOT META.
// Pattern: Self-Describing Module (same as ops-catalog in @geostat/expr).

export type SpecField = {
  key:         string
  label:       { ka: string; en: string }
  description: { ka: string; en: string }
  required:    boolean
  type:        string   // human-readable hint: 'ObsQuery' | 'RowSpec[]' | 'string' | etc.
}

export type SpecDescriptor = {
  label:            { ka: string; en: string }
  description:      { ka: string; en: string }
  constructorReady: boolean   // false = has fn field, Constructor cannot generate
  fields:           SpecField[]
  example:          string
}

export const SPEC_CATALOG: Record<string, SpecDescriptor> = {

  'query': {
    label:            { ka: 'მოთხოვნა',      en: 'Query' },
    description:      {
      ka: 'ObsQuery + pipeline + EncodingSpec. უნივერსალური: ნებისმიერი განზომილება, ნებისმიერი სტორი.',
      en: 'ObsQuery + transform pipeline + EncodingSpec. Universal: any dimension, any store.',
    },
    constructorReady: true,
    fields: [
      { key: 'query',    label: { ka: 'SDMX მოთხოვნა', en: 'SDMX Query'  }, description: { ka: 'ObsQuery ობიექტი (code, dims, years...)',              en: 'ObsQuery object (code, dims, years...)' },              required: true,  type: 'ObsQuery'       },
      { key: 'pipe',     label: { ka: 'პაიპლაინი',     en: 'Pipeline'    }, description: { ka: 'TransformStep[] — sort, filter, group, melt და სხვ.',  en: 'TransformStep[] — sort, filter, group, melt, etc.' },    required: false, type: 'TransformStep[]' },
      { key: 'encoding', label: { ka: 'ენკოდინგი',     en: 'Encoding'    }, description: { ka: 'EncodingSpec — x, y, color, label სვეტების ბეჭდვა.',   en: 'EncodingSpec — maps fields to x, y, color, label.' },    required: true,  type: 'EncodingSpec'    },
      { key: 'fromDim',  label: { ka: 'საწყისი განზ.', en: 'From Dim'   }, description: { ka: 'განზომილება, საიდანაც იწყება სვლა (time range pivot).', en: 'Dimension to pivot from (time range use).' },            required: false, type: 'string'          },
      { key: 'toDim',    label: { ka: 'საბოლოო განზ.', en: 'To Dim'     }, description: { ka: 'განზომილება, რომლამდეც სვლა.',                          en: 'Dimension to pivot to.' },                                required: false, type: 'string'          },
    ],
    example: '{ "type": "query", "query": { "code": "GDP", "dims": { "geo": { "$ctx": "geo" } }, "years": { "$ctx": "year" } }, "encoding": { "x": "time", "y": "value" } }',
  },

  'row-list': {
    label:            { ka: 'სტრიქონების სია', en: 'Row List' },
    description:      {
      ka: 'ცალსახა RowSpec[] — მოსახერხებელი მოკლე ჩანაწერი წლის რეჟიმის სექციებისთვის.',
      en: 'Explicit RowSpec[] — convenient shorthand for year-mode sections.',
    },
    constructorReady: true,
    fields: [
      { key: 'rows', label: { ka: 'სტრიქონები', en: 'Rows' }, description: { ka: 'RowSpec[] — code, label, color, negate, isTotal, pctOf.', en: 'RowSpec[] — code, label, color, negate, isTotal, pctOf.' }, required: true, type: 'RowSpec[]' },
    ],
    example: '{ "type": "row-list", "rows": [{ "code": "GDP", "label": "მშპ" }, { "code": "EXP", "label": "ექსპორტი" }] }',
  },

  'timeseries': {
    label:            { ka: 'დროითი მწკრივი', en: 'Timeseries' },
    description:      {
      ka: 'ერთი მაჩვენებელი × დროის დიაპაზონი.',
      en: 'Single measure across a time range.',
    },
    constructorReady: true,
    fields: [
      { key: 'code',    label: { ka: 'მაჩვენებელი',    en: 'Code'     }, description: { ka: 'ინდიკატორის კოდი.',                           en: 'Indicator code.' },                        required: true,  type: 'string'   },
      { key: 'years',   label: { ka: 'წლები',          en: 'Years'    }, description: { ka: 'YearsSpec — number[] ან "all".',              en: 'YearsSpec — number[] or "all".' },         required: true,  type: 'YearsSpec' },
      { key: 'fromDim', label: { ka: 'საწყისი განზ.', en: 'From Dim' }, description: { ka: 'განზომილება, საიდანაც იწყება სვლა.', en: 'Dimension to pivot from.' },        required: false, type: 'string'   },
      { key: 'toDim',   label: { ka: 'საბოლოო განზ.', en: 'To Dim'   }, description: { ka: 'განზომილება, რომლამდეც სვლა.',        en: 'Dimension to pivot to.' },          required: false, type: 'string'   },
    ],
    example: '{ "type": "timeseries", "code": "GDP", "years": [2015, 2016, 2017, 2018, 2019, 2020] }',
  },

  'growth': {
    label:            { ka: 'ზრდის ტემპი',   en: 'Growth' },
    description:      {
      ka: 'წინა წელთან ზრდის ტემპი (YoY). Multi-code → Pivot ცხრილი.',
      en: 'Year-over-year growth rates. Multi-code → pivot table.',
    },
    constructorReady: true,
    fields: [
      { key: 'code',    label: { ka: 'კოდი/კოდები',  en: 'Code(s)'  }, description: { ka: 'ერთი ან მრავალი ინდიკატორის კოდი.',      en: 'Single or multiple indicator codes.' },    required: true,  type: 'string | string[]' },
      { key: 'years',   label: { ka: 'წლები',        en: 'Years'    }, description: { ka: 'YearsSpec — number[] ან "all".',          en: 'YearsSpec — number[] or "all".' },         required: true,  type: 'YearsSpec'         },
      { key: 'fromDim', label: { ka: 'საწყისი განზ.',en: 'From Dim' }, description: { ka: 'განზომილება, საიდანაც იწყება სვლა.', en: 'Dimension to pivot from.' },        required: false, type: 'string'            },
      { key: 'toDim',   label: { ka: 'საბოლოო განზ.',en: 'To Dim'   }, description: { ka: 'განზომილება, რომლამდეც სვლა.',        en: 'Dimension to pivot to.' },          required: false, type: 'string'            },
    ],
    example: '{ "type": "growth", "code": ["GDP", "EXP", "IMP"], "years": "all" }',
  },

  'ratio-list': {
    label:            { ka: 'კოეფიციენტების სია', en: 'Ratio List' },
    description:      {
      ka: 'ყოველი სტრიქონი = მაჩვენებელი / მნიშვნელი × 100.',
      en: 'Each row = measure / denominator × 100.',
    },
    constructorReady: true,
    fields: [
      { key: 'pairs', label: { ka: 'წყვილები', en: 'Pairs' }, description: { ka: 'pairs[] — { code, denom, label? }.', en: 'pairs[] — { code, denom, label? }.' }, required: true,  type: '{ code: string; denom: string; label?: string }[]' },
      { key: 'pipe',  label: { ka: 'პაიპლაინი', en: 'Pipeline' }, description: { ka: 'TransformStep[] — sort, filter, group...', en: 'Optional TransformStep[] applied after ratio computation.' }, required: false, type: 'TransformStep[]' },
    ],
    example: '{ "type": "ratio-list", "pairs": [{ "code": "EXP", "denom": "GDP", "label": "ექსპორტი/მშპ" }] }',
  },

  'by-mode': {
    label:            { ka: 'რეჟიმის მიხედვით', en: 'By Mode' },
    description:      {
      ka: 'timeMode-ზე განშტოება — ყოველ ModeId-ს ცალკე DataSpec.',
      en: 'Branch on timeMode — a separate DataSpec per ModeId.',
    },
    constructorReady: true,
    fields: [
      { key: 'modes', label: { ka: 'რეჟიმები', en: 'Modes' }, description: { ka: 'Record<ModeId, DataSpec> — "year" და/ან "range" კლავიშები.', en: 'Record<ModeId, DataSpec> — "year" and/or "range" keys.' }, required: true, type: 'Record<ModeId, DataSpec>' },
    ],
    example: '{ "type": "by-mode", "modes": { "year": { "type": "row-list", "rows": [...] }, "range": { "type": "timeseries", "code": "GDP", "years": "all" } } }',
  },

  'pivot': {
    label:            { ka: 'პივოტი',   en: 'Pivot' },
    description:      {
      ka: 'Wide→Long შემოკლება (transform + melt-ის სინტაქსური შაქარი).',
      en: 'Wide→long shorthand (sugar for transform + melt).',
    },
    constructorReady: true,
    fields: [
      { key: 'rows',        label: { ka: 'სტრიქონები',        en: 'Rows'         }, description: { ka: 'Record<string, DimVal>[] — სტატიკური მონაცემები.', en: 'Static row data as Record<string, DimVal>[].' }, required: true,  type: 'Record<string, DimVal>[]' },
      { key: 'keyField',    label: { ka: 'გასაღების სვეტი',   en: 'Key Field'    }, description: { ka: 'სვეტი, რომელიც გახდება გასაღები.',                 en: 'Column that becomes the key.' },                 required: true,  type: 'string'                  },
      { key: 'valueFields', label: { ka: 'მნიშვნელის სვეტები', en: 'Value Fields' }, description: { ka: 'მნიშვნელის სვეტების მასივი.',                     en: 'Array of value column names.' },                 required: true,  type: 'string[]'                },
      { key: 'colors',      label: { ka: 'ფერები',             en: 'Colors'       }, description: { ka: 'Record<string, string> — სერიის ფერები.',          en: 'Optional color map per series key.' },            required: false, type: 'Record<string, string>'  },
    ],
    example: '{ "type": "pivot", "rows": [{ "label": "ექსპორტი", "2022": 45, "2023": 48 }], "keyField": "label", "valueFields": ["2022", "2023"] }',
  },

  'transform': {
    label:            { ka: 'ტრანსფორმაცია', en: 'Transform' },
    description:      {
      ka: 'სრული დეკლარაციული pipeline (Vega-Lite transform ანალოგი) სტატიკური source-ით.',
      en: 'Full declarative pipeline (Vega-Lite transform analogue) with a static source.',
    },
    constructorReady: true,
    fields: [
      { key: 'source',   label: { ka: 'წყარო',     en: 'Source'   }, description: { ka: 'სტატიკური სტრიქონები Record<string, DimVal>[].', en: 'Static source rows as Record<string, DimVal>[].' }, required: true, type: 'Record<string, DimVal>[]' },
      { key: 'steps',    label: { ka: 'ნაბიჯები',  en: 'Steps'    }, description: { ka: 'TransformStep[] — sort, filter, group, melt და სხვ.', en: 'TransformStep[] — sort, filter, group, melt, etc.' }, required: true, type: 'TransformStep[]' },
      { key: 'encoding', label: { ka: 'ენკოდინგი', en: 'Encoding' }, description: { ka: 'EncodingSpec — x, y, color, label სვეტების ბეჭდვა.', en: 'EncodingSpec — maps fields to x, y, color, label.' }, required: true, type: 'EncodingSpec' },
    ],
    example: '{ "type": "transform", "source": [...], "steps": [{ "op": "sort", "by": "value", "dir": "desc" }], "encoding": { "x": "label", "y": "value" } }',
  },

}
