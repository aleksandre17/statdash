# vertical-slice.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — Vertical Slice: PostgreSQL → SDMX-JSON → fromSDMX → DataStore → DataRow[] → Render
 *
 * Demonstrates:
 * - Full data path, layer by layer, with current architecture
 * - SDMX-JSON wire format (universal contract — never changes)
 * - fromSDMX() adapter — Phase 1 vs Phase 2
 * - isCarryForward — SNA T-account deduplication
 * - DataSpec → interpretSpec → ctx.rows → engine.renderNode
 * - Swap matrix: what changes when each layer changes
 */

import type { DataRow, DataSpec, Observation } from '@geostat/engine'
import { fromSDMX, interpretSpec, engine } from '@geostat/engine'
import { StaticDataStore } from '@geostat/engine'
import type { RenderContext } from '@geostat/react'


// ═══════════════════════════════════════════════════════════════════════════
// Layer 1 — PostgreSQL (Hybrid Schema: Kimball + SDMX DSD)
// ═══════════════════════════════════════════════════════════════════════════
//
// SQL (not TypeScript — shown as comments):
//
// CREATE TABLE observation (
//   id            BIGSERIAL PRIMARY KEY,
//   dataset_code  VARCHAR(50)    NOT NULL,
//   time_period   INT            NOT NULL,
//   geo_code      VARCHAR(20),             -- common dim → physical column (indexed)
//   obs_value     DECIMAL(20,6),
//   obs_status    CHAR(1) DEFAULT 'A',     -- A=normal P=prelim E=estimate R=revised
//   unit          VARCHAR(20),
//   extra_dims    JSONB DEFAULT '{}'       -- {"indicator":"P1","account":"production","side":"R"}
// );
//
// CREATE INDEX ON observation (dataset_code, time_period);
// CREATE INDEX ON observation (dataset_code, geo_code);
// CREATE INDEX ON observation USING GIN (extra_dims);
//
// Rule: NEVER add a physical column for a new dimension. Use extra_dims JSONB.
// Common dims (time, geo) → physical columns (indexed, fast).
// Dataset-specific dims → JSONB (flexible, GIN indexed).
//
// dim_indicator: (code PK, label_ka, label_en, unit, parent_code, level, is_balancing, seq_pos)
// dim_account:   (code PK, label_ka, label_en, seq_order)
// dim_geo:       (code PK, name_ka, name_en, level, parent_id)
// dim_time:      (period PK, year, is_preliminary)


// ═══════════════════════════════════════════════════════════════════════════
// Layer 2 — HTTP boundary: SDMX-JSON 1.0 (universal contract)
// ═══════════════════════════════════════════════════════════════════════════
//
// This format is IMMUTABLE. DB schema may change. Java ORM may change.
// SDMX-JSON response: never changes.

const SDMX_RESPONSE_EXAMPLE = {
  meta: {
    schema:   'SDMX-JSON:1.0',
    id:       'NATIONAL_ACCOUNTS_GE',
    prepared: '2025-01-01T00:00:00Z',
    source:   'Geostat',
  },
  data: {
    observations: [
      // Production account — Resource (R) side
      { time: 2025, geo: 'GE', value: 178837.28, status: 'A',
        dims: { indicator: 'P1',  account: 'production', side: 'R',
                isBalancing: 0, seqPos: 0 } },
      { time: 2025, geo: 'GE', value:  92034.10, status: 'A',
        dims: { indicator: 'P2',  account: 'production', side: 'U',
                isBalancing: 0, seqPos: 1 } },
      // B1G = closing balance of production → opening of income_gen (carry-forward)
      { time: 2025, geo: 'GE', value:  86803.18, status: 'A',
        dims: { indicator: 'B1G', account: 'production', side: 'U',
                isBalancing: 1, seqPos: 2 } },  // ← NOT carry-forward (side=U, seqPos irrelevant)
      // B1G carried forward into income_generation account as Resources side
      { time: 2025, geo: 'GE', value:  86803.18, status: 'A',
        dims: { indicator: 'B1G', account: 'income_gen', side: 'R',
                isBalancing: 1, seqPos: 0 } },  // ← CARRY-FORWARD (isBalancing=1, side=R, seqPos>0 is false here but seqPos=0 means opening)
    ],
  },
}

// Phase 2 backend sends canonical codes + isCarryForward pre-computed.
// Phase 1: fromSDMX() does CODE_MAP + isCarryForward computation.


// ═══════════════════════════════════════════════════════════════════════════
// isCarryForward — SNA T-account deduplication
// ═══════════════════════════════════════════════════════════════════════════
//
// SNA sequence of accounts:
//   production account:  P1 (output) → P2 (intermediate consumption) → B1G (GDP, closing balance)
//   income_gen account:  B1G (carry-forward from production) → D1 → B2G+B3G
//
// B1G appears TWICE — same value. If both are counted → double counting.
// Must exclude the carry-forward copy.
//
// Rule: isCarryForward = isBalancing===1 AND side==='R' AND seqPos>0
//   → Closing balance of account N = opening (Resources side) of account N+1
//   → seqPos=0 on R-side = genuine opening item (not carry-forward)
//
// ❌ WRONG: filter side:'U' → loses genuine Uses-side indicators (P1, D4r, D5r, D9r)
// ✅ CORRECT: filter isCarryForward: 0

function computeIsCarryForward(o: { dims: { isBalancing?: number; side?: string; seqPos?: number } }): 0 | 1 {
  const { isBalancing, side, seqPos } = o.dims
  return (isBalancing === 1 && side === 'R' && (seqPos ?? 0) > 0) ? 1 : 0
}

// Usage in DataSpec:
const accountSequenceSpec: DataSpec = {
  type:   'query',
  storeId: 'accounts',
  filter: { isCarryForward: 0 },    // ✅ — excludes carry-forward duplicates
}


// ═══════════════════════════════════════════════════════════════════════════
// Layer 3 — fromSDMX adapter (ONLY format boundary)
// ═══════════════════════════════════════════════════════════════════════════
//
// Phase 1 (current): CODE_MAP normalization + isCarryForward computation in frontend.
// Phase 2 (clean):   Backend sends canonical codes + isCarryForward. Adapter = pure flatten.

// Phase 1 adapter (current state — two compromises documented):
const CODE_MAP: Record<string, string> = {
  'B1g': 'B1G', 'B2g': 'B2G', 'B5g': 'B5G', 'B6g': 'B6G', 'B8g': 'B8G',
  'D4r': 'D4_REC', 'D4p': 'D4_PAY', 'D5r': 'D5_REC', 'D5p': 'D5_PAY',
}

function fromSDMXPhase1(response: typeof SDMX_RESPONSE_EXAMPLE): Observation[] {
  return response.data.observations.map(o => {
    const indicator      = CODE_MAP[o.dims.indicator] ?? o.dims.indicator  // Phase 1: normalize
    const isCarryForward = computeIsCarryForward(o)                         // Phase 1: compute
    return {
      time:  o.time,
      value: o.value ?? null,
      status: o.status,
      ...o.dims,
      indicator,
      isCarryForward,
    } as Observation
  })
}

// Phase 2 adapter (backend sends canonical codes + pre-computed isCarryForward):
function fromSDMXPhase2(response: typeof SDMX_RESPONSE_EXAMPLE): Observation[] {
  return response.data.observations.map(o => ({
    time:   o.time,
    value:  o.value ?? null,
    status: o.status,
    ...o.dims,        // backend sends: canonical codes + isCarryForward already computed
  } as Observation))
}

// CODE_MAP lives ONLY in src/data/{dataset}/adapter.ts — never in engine or packages/.
// fromSDMX() is the ONLY function that knows the SDMX-JSON wire format.


// ═══════════════════════════════════════════════════════════════════════════
// Layer 4 — DataStore (Repository Pattern, SYNC)
// ═══════════════════════════════════════════════════════════════════════════
//
// Phase 1: StaticDataStore — in-memory, fromSDMX() data injected at startup
// Phase 2: HttpDataStore   — fetch + Suspense cache, href on DataSpec

// Phase 1 setup (src/data/accounts/store.ts):
const RAW_SDMX_DATA = SDMX_RESPONSE_EXAMPLE   // real: import from './raw.ts'
const observations   = fromSDMXPhase1(RAW_SDMX_DATA)
const accountsStore  = new StaticDataStore(observations)

// Phase 2 setup (zero store setup — href on DataSpec does it):
const accountsSpecPhase2: DataSpec = {
  type:      'query',
  href:      'https://api.geostat.ge/sdmx/v1/data/NATIONAL_ACCOUNTS_GE',
  transform: 'fromSDMX',            // registered via engine.registerTransform('fromSDMX', fromSDMX)
  filter:    { isCarryForward: 0 },
}
// StaticDataStore = 0 lines of setup. Store swap = change DataSpec.storeId → DataSpec.href. That's it.


// ═══════════════════════════════════════════════════════════════════════════
// Layer 5 — DataSpec → interpretSpec → DataRow[] (Tidy Data)
// ═══════════════════════════════════════════════════════════════════════════

const gdpTimeseriesSpec: DataSpec = {
  type:      'timeseries',
  storeId:   'gdp',
  indicator: 'B1G',
  dims:      { geo: { $ctx: 'geo' }, time: { $ctx: 'time' } },
}

// interpretSpec is called INSIDE engine.renderNode — not by the renderer directly.
// ctx.rows is set before the renderer is invoked.

// Manual call (for testing / custom use):
// const rows: DataRow[] = interpretSpec(gdpTimeseriesSpec, ctx, ctx.stores)
// rows → [{ time: 2020, value: 60000 }, { time: 2021, value: 63000 }, ...]


// ═══════════════════════════════════════════════════════════════════════════
// Layer 6 — engine.renderNode pipeline
// ═══════════════════════════════════════════════════════════════════════════
//
// Per node, in order:
//   1. evalDerived(node.derive, scope)        → ctx.derived
//   2. evalExpr(node.visibleWhen, scope)      → false → return null
//   3. interpretSpec(node.data, ctx, stores)  → ctx.rows
//   4. evalViewParams(node.view, scope)       → ctx.view (resolved scalars)
//   5. renderNode(child, ctx) per child       → ChildrenArg
//   6. registry.get(type)(node, ctx, children) → ReactNode

const gdpChartNode = {
  type: 'chart',
  data: gdpTimeseriesSpec,
  def:  {
    type:     'line',
    encoding: {
      x: { field: 'time',  type: 'temporal' as const },
      y: { field: 'value', type: 'quantitative' as const, format: '#,##0', title: 'მლნ ₾' },
    },
  },
}

// engine.renderNode(gdpChartNode, baseCtx)
// → interpretSpec(gdpTimeseriesSpec, ctx, stores) → ctx.rows
// → registry.get('chart')(node, ctx, children)
// → shell = ctx.theme.shells['chart']
// → shell({ def: node, ctx }) → <ReactApexChart />


// ═══════════════════════════════════════════════════════════════════════════
// Complete vertical slice: URL → React
// ═══════════════════════════════════════════════════════════════════════════
//
//   URL ?geo=GE&time=2025
//       → FilterContext.dims = { geo: 'GE', time: 2025 }
//       → baseCtx.dims = { geo: 'GE', time: 2025 }
//
//   engine.renderNode(gdpChartNode, baseCtx)
//       → interpretSpec({ type:'timeseries', storeId:'gdp', indicator:'B1G',
//                          dims:{ geo:{$ctx:'geo'}, time:{$ctx:'time'} } }, ctx, stores)
//             → stores['gdp'].query({ indicators:['B1G'], dims:{ geo:'GE', time:2025 } })
//             → [{ time:2025, value:86803, indicator:'B1G', geo:'GE' }]
//             → ctx.rows = above
//       → registry.get('chart')(node, ctx, [])
//             → interpretChart(node.def, ctx.rows, ctx) → ChartOutput
//             → toApexOptions(output) → ApexCharts.ApexOptions
//             → ctx.theme.shells['chart']({ def:node, ctx })
//             → <ReactApexChart options={...} series={...} />


// ═══════════════════════════════════════════════════════════════════════════
// Swap matrix — layer isolation proof
// ═══════════════════════════════════════════════════════════════════════════
//
// | Change                              | Files affected                        |
// |-------------------------------------|---------------------------------------|
// | SQL column rename                   | JPA entity only                       |
// | ORM swap (JPA → jOOQ)              | JpaObservationRepository only         |
// | New dataset (trade, regional)       | new raw.ts + adapter.ts + store.ts    |
// | Static → live API                  | DataSpec: storeId → href (1 field)    |
// | New chart type                      | engine.registerTransform() only       |
// | New DataSpec type                   | engine.extendSpec() only              |
// | ApexCharts → Recharts              | toApexOptions() only — zero engine    |
// | New filter type                     | registerFilterControl() only          |
// | New node type                       | engine.extend(nodeRegistry) only      |
// | New page                            | JSON PageConfig — zero code changes   |
// | Backend language (Java → Go)        | fromSDMX() adapter only              |
// | CODE_MAP removal (Phase 2)          | fromSDMX() adapter only              |
// | isCarryForward server-side (Phase 2)| fromSDMX() adapter only              |


// ═══════════════════════════════════════════════════════════════════════════
// SNA 2008 indicator codes — canonical (SDMX standard)
// ═══════════════════════════════════════════════════════════════════════════
//
// P1      → Output (გამოშვება)
// P2      → Intermediate consumption (შუალ. მოხმ.)
// B1G     → GDP / Gross Value Added
// D1      → Compensation of employees (შრომის ანაზღ.)
// D2      → Taxes on products
// D3      → Subsidies
// B2G+B3G → Operating surplus + Mixed income
// B5G     → Gross National Income (GNI)
// B6G     → Gross Disposable Income
// B8G     → Gross Saving
// P51G    → Gross Fixed Capital Formation
// B9      → Net lending/borrowing
//
// SNA sequence (balancing item cascade):
//   production:   P1 → P2 → B1G
//   income_gen:   B1G (carry-fwd) + D1, D2-D3 → B2G+B3G
//   primary_dist: B2G+B3G + D4 → B5G
//   secondary:    B5G + transfers → B6G
//   use_income:   B6G → P3 → B8G
//   capital:      B8G + D9r → P51G → B9
```
