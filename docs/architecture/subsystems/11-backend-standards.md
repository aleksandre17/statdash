
# Backend Standards — Data Architecture

> Reference orgs: Eurostat (SDMX.Stat), IMF (Data Mapper), OECD (OECD.Stat), World Bank
> Stack: SDMX DSD → Kimball Star Schema → OLAP → SDMX-JSON API → fromSDMX() adapter

---

## Full Pipeline

```
SNA 2008 / ESA 2010 classification
         ↓
   SDMX DSD (data structure definition)
         ↓
   PostgreSQL (Hybrid Star Schema)
         ↓
   Java/Spring SDMX-JSON response
         ↓  ← boundary (only format change here)
   fromSDMX() → Observation[]
         ↓
   DataStore (static or API)
         ↓
   interpretSpec(spec, ctx, store) → DataRow[]
         ↓
   chart / table / kpi rendering
```

**The adapter boundary is sacred.** Everything above it = backend domain. Everything below it = frontend domain. `fromSDMX` converts format, does NOT compute business rules.

---

## Standard B1: SDMX DSD (ISO 17369)

**Who uses it:** Eurostat, IMF, ECB, OECD, UN Stats, World Bank — all major stats organizations.

DSD = schema contract. Defines what a DataFlow contains before DB is built:

```
DataFlow: NATIONAL_ACCOUNTS_GE
  Dimensions:
    TIME_PERIOD   → int (year/quarter)
    INDICATOR     → P1 | B1g | D1 | ... (SDMX codelist)
    ACCOUNT       → production | income_gen | ...
    GEO           → GE | GE-TB | GE-KA | ...
    SIDE          → R | U
  Measure:
    OBS_VALUE     → decimal
  Attributes:
    OBS_STATUS    → A | P | E | M  (normal / preliminary / estimate / missing)
    OBS_CONF      → F | C          (free / confidential)
    TIME_FORMAT   → P1Y | P1Q      (annual / quarterly)
    UNIT_MEASURE  → GEL | USD | PCT
```

Every dataset fits this structure. Different DataFlows have different dimensions — same structural pattern.

---

## Standard B2: Kimball Dimensional Modeling — Star Schema

**Who uses it:** Every stats organization at DWH level.

```
              fact_observation
              ┌──────────────────────────────────┐
              │ obs_id        BIGSERIAL PK        │
              │ dataset_code  VARCHAR(50)         │
dim_time ─────│ time_period   INT                 │
dim_indicator─│ indicator_id  INT FK              │
dim_account ──│ account_id    INT FK (nullable)   │
dim_geo ──────│ geo_id        INT FK (nullable)   │
              │ obs_value     DECIMAL(20,6)       │
              │ obs_status    CHAR(1)             │
              │ obs_conf      CHAR(1)             │
              └──────────────────────────────────┘

dim_indicator: (id, code, label_ka, label_en, unit, sna_ref,
                is_balancing, seq_pos, seq_end,
                parent_code, level, is_leaf)     ← hierarchy support
dim_account:   (id, code, label_ka, label_en, seq_order)
dim_geo:       (id, code, name_ka, name_en, level, parent_id)
dim_time:      (period, year, quarter, is_preliminary)
```

Snowflake extension for hierarchy:
```sql
dim_indicator.parent_code REFERENCES dim_indicator(code)  -- self-referencing
dim_indicator.level       -- 0=root, 1=child, 2=grandchild
```

---

## Agreed DB Strategy: Hybrid Schema ✅

```sql
CREATE TABLE observation (
  id            BIGSERIAL PRIMARY KEY,
  dataset_code  VARCHAR(50)    NOT NULL,
  time_period   INT            NOT NULL,
  geo_code      VARCHAR(20),             -- common → physical column, indexed
  obs_value     DECIMAL(20,6),
  obs_status    CHAR(1) DEFAULT 'A',
  obs_conf      CHAR(1) DEFAULT 'F',
  unit          VARCHAR(20),
  extra_dims    JSONB DEFAULT '{}'       -- {"indicator":"P1","account":"production","side":"R"}
);

CREATE INDEX ON observation (dataset_code, time_period);
CREATE INDEX ON observation (dataset_code, geo_code);
CREATE INDEX ON observation USING GIN (extra_dims);
```

**Rule: Never add a physical column for a new dimension. Use `extra_dims` JSONB.**

Why: Different datasets have different dimensions. JSONB + GIN index handles arbitrary dims efficiently. This is the Eurostat/IMF pattern for multi-dataset warehouses.

---

## Standard B4: SNA 2008 / ESA 2010 Codes

All indicator codes in DB use canonical SNA codes — NOT Georgian labels:

```
P1      → გამოშვება (Output)
P2      → შუალედური მოხმარება (Intermediate consumption)
B1G     → GDP / მთლიანი დამატებული ღირებულება
D1      → შრომის ანაზღაურება
D2      → გადასახადები პროდუქტებზე
D3      → სუბსიდიები
B2G+B3G → საოპერაციო მოგება + შერეული შემოსავალი
B5G     → მთლიანი ეროვნული შემოსავალი (GNI)
B6G     → მთლიანი განკარგვადი შემოსავალი
B8G     → მთლიანი დანაზოგი
P51G    → მთლიანი კაპიტალის ფორმირება
B9      → წმინდა დაკრედიტება/სესხება
```

### SNA Sequence of Accounts (balancing item cascade)

```
წარმოების ანგარიში:    P1 → P2 → B1G
შემ. ფორმირება:        B1G → D1, D2-D3 → B2G+B3G
პირველ. განაწ.:        B2G+B3G + D1, D2-D3, D4 → B5G
მეორად. განაწ.:        B5G + transfers → B6G
შემ. გამოყენება:       B6G → P3 → B8G
კაპიტალის ანგ.:        B8G + D9r → P51G, D9p → B9
```

**Balancing item cascade rule:** Every account's balancing item (B1G, B2G+B3G...) is the opening item of the next account. `is_balancing = true` in `dim_indicator`.

### isCarryForward — SNA Deduplication

```ts
// ✅ Correct: filter by isCarryForward field
store.getRows({ indicator: 'B1G' }).filter(r => r.isCarryForward === 0)

// ❌ Wrong: side: 'U' filter loses valid Uses data
store.getRows({ indicator: 'B1G', side: 'R' })
```

**Phase 1:** `fromSDMX` adapter computes `isCarryForward` (SNA rule: `isBalancing && side === 'R' && seqPos > 0`).
**Phase 2:** Backend sends `isCarryForward: 0|1` field directly. Adapter becomes pure format converter.

---

## API Contract: SDMX-JSON

```json
{
  "meta": {
    "schema":   "SDMX-JSON:1.0",
    "id":       "national_accounts",
    "prepared": "2025-01-01T00:00:00Z",
    "source":   "Geostat"
  },
  "data": {
    "observations": [
      {
        "time":   2025,
        "geo":    "GE",
        "value":  178837.28,
        "status": "A",
        "dims": { "indicator": "P1", "account": "production", "side": "R" }
      }
    ]
  }
}
```

**The contract does not change.** DB schema may change. Java DTO may change. SDMX-JSON response — immutable contract.

---

## fromSDMX Adapter — Current State

```ts
// Phase 1 (current) — includes two compromises:
export function fromSDMX(response: SDMXResponse): Observation[] {
  return response.data.observations.map(o => {
    const measure = CODE_MAP[o.dims.measure] ?? o.dims.measure  // Phase 1 fix
    const isCarryForward = computeIsCarryForward(o)              // Phase 1 computation
    return { time: o.time, value: o.value, ...o.dims, measure, isCarryForward }
  })
}

// Phase 2 (clean) — pure format conversion only:
export function fromSDMX(response: SDMXResponse): Observation[] {
  return response.data.observations.map(o => ({
    time:   o.time,
    value:  o.value,
    status: o.status,
    ...o.dims,  // backend sends: canonical codes + isCarryForward already computed
  }))
}
```

**Phase 2 backend tasks:**
1. Send canonical codes (`B1G` not `B1g`) — removes `CODE_MAP`
2. Compute `isCarryForward` server-side — removes frontend SNA logic

---

## OLAP Projection

```
cube[TIME][INDICATOR][GEO][ACCOUNT] = OBS_VALUE

ctx.dims: Record<string, DimVal>  =  frontend projection of backend OLAP cube
```

A `DataSpec` query = slice of this cube:
```ts
{ type: 'query', storeId: 'accounts', indicator: 'B1G' }
// → cube['*']['B1G']['GE']['*'] filtered by current ctx.dims
```

---

## Reference Bibliography

| Standard | Source |
|---|---|
| SDMX | ISO 17369; sdmx.org; SDMX-JSON 2.0 spec |
| Kimball | "The Data Warehouse Toolkit" (2013) |
| SNA 2008 | UN System of National Accounts |
| ESA 2010 | European System of Accounts (Eurostat) |
| Hexagonal | Alistair Cockburn (2005) |
| SDMX.Stat | OECD platform (open source reference impl) |
