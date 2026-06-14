# repeat-node.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — RepeatNode: declarative iteration over a JSON array
 *
 * The Repeat pattern is the Builder.io RepeatData / Retool List equivalent:
 * one JSON template definition renders N times, each with an independent
 * RenderContext. No code change to add a new item — edit the config array.
 *
 * Two iteration modes:
 *   Static  (def.each)  — plain JSON array, no DataSpec needed.
 *   Dynamic (node.data) — rows from a query; each DataRow becomes an item.
 *
 * Per-item context injection (both modes):
 *   ctx.vars[as]           = item object (full access)
 *   ctx.vars[`${as}_k`]   = item[k]  (flat — usable in {template} strings)
 *   ctx.sectionCtx.dims[as] = item.code  (so { $ctx: 'account' } resolves per item)
 *   ctx.color              = item.color  (when present — cascades to all children)
 *
 * Platform precedents:
 *   Builder.io  — RepeatData component: array + children template
 *   Retool      — List widget: data array + item template
 *   Appsmith    — List widget: same pattern
 *   React       — array.map(item => <Component key={item.id} {...item} />)
 *   Grafana     — no direct equivalent; closest: panel repeat variable
 */

import type { NodeDef, NodeBase, NodeRenderer, SlotDef, RenderContext, ChildrenArg } from '@geostat/react/engine'

// ─────────────────────────────────────────────────────────────────────────────
// 1. TYPE DEFINITION — plugins/nodes/repeat/default/RepeatNode.ts
// ─────────────────────────────────────────────────────────────────────────────

declare module '@geostat/react/engine' {
  interface NodeTypeMap { 'repeat': RepeatNode }
}

export interface RepeatNode extends NodeBase {
  type:     'repeat'
  as:       string                       // variable namespace: 'account', 'region', 'sector', …
  each?:    Record<string, unknown>[]    // static items list (alternative to node.data DataSpec)
  children: NodeDef[]                    // template rendered once per item
}

// JSON.parse(JSON.stringify(node)) === node ✅ — both modes are fully serializable


// ─────────────────────────────────────────────────────────────────────────────
// 2. SHELL — plugins/nodes/repeat/default/RepeatShell.tsx
//    What happens under the hood
// ─────────────────────────────────────────────────────────────────────────────

export const RepeatShell: NodeRenderer<RepeatNode> = (def, ctx, children) => {
  // Priority: static def.each → dynamic ctx.rows (from node.data DataSpec)
  const rawItems: Record<string, unknown>[] =
    def.each ?? (ctx.rows as unknown as Record<string, unknown>[]) ?? []

  if (rawItems.length === 0) return null

  // One Fragment per item — each gets its own isolated RenderContext
  return rawItems.map((item, i) => {
    const itemKey = String(item['code'] ?? item['id'] ?? i)

    // ── Flat vars: account_code, account_label, account_color, …
    //    One entry per field in item object. Used in {template} strings.
    const flatVars: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(item)) {
      flatVars[`${def.as}_${k}`] = v
    }

    // ── Override dims[as] so { $ctx: 'account' } in child DataSpecs
    //    resolves to this item's code — the key mechanism.
    const dims = item['code'] != null
      ? { ...ctx.sectionCtx.dims, [def.as]: item['code'] as string }
      : ctx.sectionCtx.dims

    // ── Build per-item ctx override. ctx.renderNode merges this with the
    //    full base context: renderNodeFn(child, { ...ctxHolder.ctx, ...override })
    const ctxOverride: Partial<RenderContext> = {
      vars:       { ...ctx.vars, [def.as]: item, ...flatVars },
      sectionCtx: { ...ctx.sectionCtx, dims },
      ...(typeof item['color'] === 'string' ? { color: item['color'] } : {}),
    }

    // ── children.defs (NOT children.rendered!) because rendered[] uses the
    //    original ctxM — each iteration must get its own independent context.
    return children.defs.map((child, j) =>
      ctx.renderNode(child, ctxOverride)   // key: j, itemKey handled by Fragment above
    )
  })
}

// ── Why children.defs, not children.rendered ─────────────────────────────────
//
//  children.rendered is a lazy Proxy backed by ctxM (the context at render time).
//  All 3 iterations would share the same ctxM → same dims → same data → wrong.
//
//  children.defs + ctx.renderNode(child, override) triggers a fresh renderNode
//  call per item per child, each with its own isolated context. This is the
//  fundamental property of the Repeat pattern.


// ─────────────────────────────────────────────────────────────────────────────
// 3. CONTEXT FLOW — step by step
// ─────────────────────────────────────────────────────────────────────────────

// Given:
//   each: [
//     { code: 'production', label: 'წარმოების ანგარიში', color: '#0080BE' },
//     { code: 'income_gen', label: 'შემოსავლის ფორმირება', color: '#E76F51' },
//     { code: 'capital',    label: 'კაპიტალის ანგარიში',  color: '#4472C4' },
//   ]
//   page filterParams: { time: 2024, account: 'production' }  ← user selection
//
// iteration i=0 (production):
//   ctxOverride = {
//     vars:       { account: item, account_code: 'production', account_label: 'წარმოება…' },
//     sectionCtx: { timeMode: 'year', dims: { time: 2024, account: 'production' } },
//     color:      '#0080BE',
//   }
//   renderNode(sectionChild, ctxOverride)
//     → SectionShell receives: resolvedId='account-production', title='წარმოების ანგარიში'
//     → useGlobalVar('section:view:account-production')  ← unique per iteration
//     → child DataSpec filter: { account: { $ctx: 'account' } }
//         → dims['account'] = 'production'
//         → SQL WHERE account = 'production'
//
// iteration i=1 (income_gen):
//   ctxOverride.sectionCtx.dims = { time: 2024, account: 'income_gen' }
//   ctxOverride.color = '#E76F51'
//   → SQL WHERE account = 'income_gen'
//   → useGlobalVar('section:view:account-income_gen')   ← different GlobalState slot
//
// iteration i=2 (capital):
//   ctxOverride.sectionCtx.dims = { time: 2024, account: 'capital' }
//   ctxOverride.color = '#4472C4'
//   → SQL WHERE account = 'capital'
//   → useGlobalVar('section:view:account-capital')      ← different GlobalState slot


// ─────────────────────────────────────────────────────────────────────────────
// 4. SectionShell — template resolution for id and title
//    plugins/nodes/section/default/SectionShell.tsx
// ─────────────────────────────────────────────────────────────────────────────

// SectionShell runs resolveTemplate on id and title when they contain '{'.
// templateParams = { ...ctx.filterParams, ...ctx.vars }
//
//  def.id    = 'account-{account_code}'
//  def.title = '{account_label}'
//
//  resolvedId  = resolveTemplate('account-{account_code}', sectionCtx, templateParams)
//              = 'account-production'  (i=0), 'account-income_gen'  (i=1), …
//
//  title       = resolveTemplate('{account_label}', sectionCtx, templateParams)
//              = 'წარმოების ანგარიში'  (i=0), 'შემოსავლის ფორმირება'  (i=1), …
//
//  GlobalState key = `section:view:${resolvedId}`  ← unique; persists chart/table toggle
//  DOM id          = resolvedId                    ← unique; anchor links work
//
// IMPORTANT: templateParams is computed BEFORE useGlobalVar. Hooks order is stable.


// ─────────────────────────────────────────────────────────────────────────────
// 5. FULL CONFIG EXAMPLE — accounts page (static mode)
//    src/pages/accounts.sections.ts
// ─────────────────────────────────────────────────────────────────────────────

const accountsRepeatSection: NodeDef = {
  type: 'repeat',
  as:   'account',
  view: { visibleWhen: { op: 'eq', param: 'mode', is: 'year' } },

  // ── Static items — edit here to add/remove/reorder accounts, zero code change
  each: [
    { code: 'production', label: 'წარმოების ანგარიში',    color: '#0080BE' },
    { code: 'income_gen', label: 'შემოსავლის ფორმირება', color: '#E76F51' },
    { code: 'capital',    label: 'კაპიტალის ანგარიში',   color: '#4472C4' },
  ],

  // ── Template — rendered once per item, each with independent context
  children: [
    {
      type:  'section',
      id:    'account-{account_code}',    // resolves to 'account-production', etc.
      title: '{account_label}',           // resolves to item label per iteration
      view:  { subtitle: '{time} · მლნ ₾', toggle: true },

      children: [
        {
          type: 'chart', chartType: 'hbar-diverging', compact: true,
          view: { role: 'chart', label: 'დიაგრამა' },
          fieldConfig: { unit: 'მლნ ₾' },
          data: {
            type:  'query',
            query: {
              measure: '*',
              // { $ctx: 'account' } resolves to dims['account'] = item.code per iteration
              filter: { time: { $ctx: 'time' }, account: { $ctx: 'account' } },
            },
            pipe: [
              { op: 'join',     with: { $cl: 'aggregates' }, on: 'measure', fields: ['isClosing'] },
              { op: 'sort',     by: [{ field: 'side', using: ['R', 'U'] }, { field: 'seqPos', dir: 'asc', last: -1 }, { field: 'isClosing', dir: 'asc' }] },
              { op: 'lookup',   key: 'measure', from: { $d: 'aggregates' }, fields: ['label', 'color'] },
              { op: 'lookup',   key: 'side', from: { R: { series: 'რესურსები', color: '#4472C4' }, U: { series: 'გამოყენება', color: '#E76F51' } }, fields: ['series', 'color'] },
              { op: 'template', as: 'label', tpl: '{label} ({measure})' },
              { op: 'concat',   fields: ['measure', 'side'], as: '_id' },
              { op: 'rename',   fields: { isClosing: '_isTotal' } },
            ],
            encoding: { label: 'label', series: 'series', color: 'color', id: '_id', isTotal: '_isTotal' },
          },
        },
        {
          type: 'table',
          columns: [{ key: 'value', label: 'მლნ ₾', format: 'mln_gel', bar: true }],
          indent: true, statusFlags: false,
          view: { role: 'table', label: 'ცხრილი' },
          data: {
            type:  'query',
            query: { measure: '*', filter: { time: { $ctx: 'time' }, account: { $ctx: 'account' } } },
            pipe: [
              { op: 'join',     with: { $cl: 'aggregates' }, on: 'measure', fields: ['isClosing'] },
              { op: 'sort',     by: [{ field: 'side', using: ['R', 'U'] }, { field: 'seqPos', dir: 'asc', last: -1 }, { field: 'isClosing', dir: 'asc' }] },
              { op: 'lookup',   key: 'measure', from: { $d: 'aggregates' }, fields: ['label', 'color'] },
              { op: 'lookup',   key: 'side', from: { R: { series: 'რესურსები', color: '#4472C4' }, U: { series: 'გამოყენება', color: '#E76F51' } }, fields: ['series', 'color'] },
              { op: 'template', as: 'label', tpl: '{label} ({measure})' },
              { op: 'concat',   fields: ['measure', 'side'], as: '_id' },
              { op: 'rename',   fields: { isClosing: '_isTotal' } },
            ],
            encoding: { label: 'label', series: 'series', color: 'color', id: '_id', isTotal: '_isTotal' },
          },
        },
      ],
    },
  ],
} as NodeDef


// ─────────────────────────────────────────────────────────────────────────────
// 6. DYNAMIC MODE — node.data DataSpec (rows from a query)
//    RepeatShell uses ctx.rows when def.each is absent
// ─────────────────────────────────────────────────────────────────────────────

const dynamicRepeat: NodeDef = {
  type: 'repeat',
  as:   'region',
  // Rows fetched from store via DataSpec — each row becomes an iteration item
  data: {
    type:  'query',
    query: { measure: 'GEO_LIST', filter: { parent: { $ctx: 'geo' } } },
    pipe:  [{ op: 'sort', by: 'label', dir: 'asc' }],
  },
  children: [
    {
      type:  'section',
      id:    'region-{region_code}',
      title: '{region_label}',            // 'label' field from DataRow injected as region_label
      view:  { subtitle: '{time}' },
      children: [
        {
          type: 'chart', chartType: 'bar',
          data: {
            type:  'query',
            query: { measure: 'B1G', filter: { time: { $ctx: 'time' }, geo: { $ctx: 'region' } } },
            // dims['region'] = row.code per iteration — exactly like static mode
          },
        },
      ],
    },
  ],
} as NodeDef


// ─────────────────────────────────────────────────────────────────────────────
// 7. WHAT ELSE CAN BE BUILT WITH THIS ARCHITECTURE
// ─────────────────────────────────────────────────────────────────────────────

// ── A. Multi-indicator comparison ────────────────────────────────────────────
//
//  Show GDP, household consumption, gross investment — each as its own
//  fully-styled section with chart + table, all from one template.
//
const indicatorComparison: NodeDef = {
  type: 'repeat',
  as:   'indicator',
  each: [
    { code: 'B1G',  label: 'მშპ',                  color: '#0080BE', unit: 'მლნ ₾' },
    { code: 'P3',   label: 'საოჯახო მოხმარება',    color: '#E76F51', unit: 'მლნ ₾' },
    { code: 'P51G', label: 'მთლიანი ინვ.',         color: '#4472C4', unit: 'მლნ ₾' },
  ],
  children: [{
    type: 'section', id: 'ind-{indicator_code}', title: '{indicator_label}',
    view: { subtitle: '{time} · {indicator_unit}', toggle: true },
    children: [
      { type: 'chart', chartType: 'line',
        data: { type: 'timeseries', query: { measure: '{indicator_code}' } } },
      { type: 'table',
        data: { type: 'timeseries', query: { measure: '{indicator_code}' } } },
    ],
  }],
} as NodeDef


// ── B. Regional breakdown — one section per region ───────────────────────────
//
//  Regions fetched dynamically from store. Adding a new region to the DB
//  automatically adds a new section — zero config change.
//
const regionalBreakdown: NodeDef = {
  type: 'repeat',
  as:   'region',
  data: { type: 'query', query: { measure: 'REGION_LIST' }, pipe: [{ op: 'sort', by: 'label', dir: 'asc' }] },
  children: [{
    type: 'section', id: 'reg-{region_code}', title: '{region_label}',
    view: { subtitle: '{time} · GDP წილი', toggle: true, defaultOpen: false },
    children: [
      { type: 'chart', chartType: 'bar',
        data: { type: 'query', query: { measure: 'B1G', filter: { geo: { $ctx: 'region' }, time: { $ctx: 'time' } } } } },
      { type: 'table',
        data: { type: 'query', query: { measure: 'B1G', filter: { geo: { $ctx: 'region' }, time: { $ctx: 'time' } } } } },
    ],
  }],
} as NodeDef


// ── C. Sector structure — GVA by economic sector ─────────────────────────────
//
//  Each sector shows its GVA share + trend. Constructor user drags "Repeat"
//  onto the canvas, picks data source, picks child template → done.
//
const sectorStructure: NodeDef = {
  type: 'repeat',
  as:   'sector',
  each: [
    { code: 'AGRI', label: 'სოფლის მეურნეობა', color: '#70AD47' },
    { code: 'IND',  label: 'მრეწველობა',       color: '#ED7D31' },
    { code: 'SERV', label: 'მომსახურება',       color: '#4472C4' },
    { code: 'CONS', label: 'მშენებლობა',       color: '#FFC000' },
  ],
  children: [{
    type: 'section', id: 'gva-{sector_code}', title: '{sector_label}',
    view: { subtitle: 'GVA წილი · %', toggle: true },
    children: [
      { type: 'chart', chartType: 'line',
        data: { type: 'query',
          query: { measure: 'GVA_SHARE', filter: { sector: { $ctx: 'sector' } } },
          encoding: { label: 'time', series: 'measure', color: 'color' } } },
    ],
  }],
} as NodeDef


// ── D. Time period tabs — year-over-year comparison ──────────────────────────
//
//  Render the same chart for multiple time points side-by-side.
//  Not really a "tab" — each year gets its own section collapsed by default.
//
const yearComparison: NodeDef = {
  type: 'repeat',
  as:   'snapshot',
  each: [
    { code: 2024, label: '2024 წ.', color: '#0080BE' },
    { code: 2023, label: '2023 წ.', color: '#7F7F7F' },
    { code: 2022, label: '2022 წ.', color: '#BFBFBF' },
  ],
  children: [{
    type: 'section', id: 'snap-{snapshot_code}', title: '{snapshot_label}',
    view: { defaultOpen: false, toggle: false },
    children: [
      // dims['snapshot'] = year → interpretSpec resolves time filter per iteration
      { type: 'chart', chartType: 'hbar',
        data: { type: 'query', query: { measure: 'B1G', filter: { time: { $ctx: 'snapshot' }, geo: { $ctx: 'geo' } } } } },
    ],
  }],
} as NodeDef


// ── E. Country comparison — multi-geo overview ────────────────────────────────
//
//  Each country gets its own row of KPI cards + a sparkline.
//  Useful for international comparison pages (IMF/World Bank standard).
//
const countryComparison: NodeDef = {
  type: 'repeat',
  as:   'country',
  each: [
    { code: 'GE',  label: 'საქართველო', color: '#E53935' },
    { code: 'ARM', label: 'სომხეთი',    color: '#5E35B1' },
    { code: 'AZE', label: 'აზერბაიჯანი', color: '#039BE5' },
  ],
  children: [{
    type: 'section', id: 'ctry-{country_code}', title: '{country_label}',
    view: { subtitle: 'GDP · მლნ USD · {time}', compact: true, defaultOpen: true },
    children: [
      { type: 'kpi-strip',
        data: { type: 'query', query: { measure: ['B1G', 'P3', 'P51G'], filter: { geo: { $ctx: 'country' }, time: { $ctx: 'time' } } } } },
      { type: 'chart', chartType: 'line',
        data: { type: 'timeseries', query: { measure: 'B1G', filter: { geo: { $ctx: 'country' } } } } },
    ],
  }],
} as NodeDef


// ── F. Report / Print layout — fixed page structure ──────────────────────────
//
//  One section per report chapter. Each chapter references the same template
//  but gets different content based on `code` mapping to a chapter DataSpec.
//  Renders identically in browser and print (CSS @media print).
//
const reportLayout: NodeDef = {
  type: 'repeat',
  as:   'chapter',
  each: [
    { code: 'overview',    label: '1. მიმოხილვა',         color: '#0080BE', order: 1 },
    { code: 'production',  label: '2. წარმოების ანგარიში', color: '#0080BE', order: 2 },
    { code: 'income',      label: '3. შემოსავლის ანგარიში', color: '#0080BE', order: 3 },
    { code: 'capital',     label: '4. კაპიტალის ანგარიში', color: '#0080BE', order: 4 },
    { code: 'methodology', label: '5. მეთოდოლოგია',        color: '#7F7F7F', order: 5 },
  ],
  children: [{
    type: 'section', id: 'ch-{chapter_code}', title: '{chapter_label}',
    view: { noCollapse: true },
    // child content resolves based on dims['chapter'] = chapter code
    children: [
      { type: 'chart', data: { type: 'by-mode', year: { type: 'query', query: { measure: '*', filter: { chapter: { $ctx: 'chapter' } } } }, range: { type: 'timeseries', query: { measure: '*', filter: { chapter: { $ctx: 'chapter' } } } } } },
    ],
  }],
} as NodeDef


// ── G. Nested Repeat — two-level grid ────────────────────────────────────────
//
//  Outer repeat: regions. Inner repeat (inside child): indicators per region.
//  Each inner render gets both dims['region'] and dims['indicator'] injected.
//  This creates a full cross-tab without any code.
//
//  ⚠ Use sparingly — N×M render calls. Prefer a pivot DataSpec for pure data.
//
const nestedRepeat: NodeDef = {
  type: 'repeat',
  as:   'region',
  each: [
    { code: 'GE_TB', label: 'თბილისი' },
    { code: 'GE_KA', label: 'კახეთი'  },
  ],
  children: [{
    type: 'section', id: 'reg-{region_code}', title: '{region_label}',
    view: { noCollapse: false },
    children: [{
      type: 'repeat',
      as:   'indicator',
      each: [
        { code: 'B1G', label: 'GVA', color: '#0080BE' },
        { code: 'P3',  label: 'მოხმ.', color: '#E76F51' },
      ],
      children: [{
        type: 'chart', chartType: 'bar',
        data: {
          type:  'query',
          // Both dims overridden: region from outer, indicator from inner
          query: { measure: '{indicator_code}', filter: { geo: { $ctx: 'region' }, time: { $ctx: 'time' } } },
        },
      }],
    }],
  }],
} as NodeDef


// ── H. Constructor integration ────────────────────────────────────────────────
//
//  Phase 2: Constructor panel shows "Repeat" in the node palette.
//  User drags it → property panel shows:
//    [as]    text input: 'account', 'region', 'sector', …
//    [each]  JSON array editor or "bind to DataSpec" toggle
//    [+]     child template area (drag-drop destination)
//
//  No code required. The schema drives the Constructor UI:
//    RepeatSchema = { required: ['as'], properties: { as: string, each: array } }
//
//  Any item added to 'each' via the Constructor panel immediately renders
//  a new section on the preview. Zero deploy.
//


// ─────────────────────────────────────────────────────────────────────────────
// 8. ANTI-PATTERNS
// ─────────────────────────────────────────────────────────────────────────────

// ❌ Duplicating sections manually:
//    { type: 'section', id: 'production', title: 'წარმოების ანგარიში', children: [...] },
//    { type: 'section', id: 'income_gen', title: 'შემოსავლის ფორმირება', children: [...] },
//    { type: 'section', id: 'capital',    title: 'კაპიტალის ანგარიში',  children: [...] },
// ✅ One repeat node with 3 items. Config is DRY. Pipe changes in one place.

// ❌ Hardcoding dims in the child DataSpec:
//    filter: { account: 'production' }   // only ever shows production
// ✅ filter: { account: { $ctx: 'account' } }
//    RepeatShell injects dims['account'] = item.code per iteration.

// ❌ Using { $derived: 'account.code' } in DataSpec filter:
//    filter: { account: { $derived: 'account.code' } }  // $derived not supported in DataSpec filter
// ✅ RepeatShell sets dims[as] = item.code. { $ctx: 'account' } resolves correctly.

// ❌ Reading ctx.vars directly in a DataSpec (doesn't exist at interpretSpec time):
//    filter: { account: { $var: 'account_code' } }  // vars not resolved by interpretSpec
// ✅ Only dims are available to interpretSpec. RepeatShell puts item.code in dims[as].

// ❌ Using children.rendered in RepeatShell:
//    rows.map((row, i) => children.rendered[i])  // rendered is backed by original ctxM → all rows see same context
// ✅ children.defs.map(child => ctx.renderNode(child, itemCtx))  — fresh context per item.

// ❌ def.id as a static string for multiple iterations:
//    id: 'account-section'  // all 3 iterations get the same GlobalState key → toggle persists incorrectly
// ✅ id: 'account-{account_code}'  — SectionShell resolves per item → unique GlobalState key.

// ❌ Nesting many levels of Repeat for a matrix:
//    3 regions × 5 indicators × 4 years = 60 renderNode trees — expensive
// ✅ Use a pivot DataSpec + a single table or chart. Repeat is for structural repetition, not data pivots.
```
