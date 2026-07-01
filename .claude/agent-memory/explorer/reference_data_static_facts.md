---
name: data_static_facts
description: Static/mock data files, DataBundle pattern, regional/accounts/GDP raw datasets
metadata:
  type: reference
---

# Static Data & DataBundle Pattern

## Universal Contract (Per Dataset)

Every dataset exports identical shape:
- **Facts** — flat Observation[] (minimal fields: measure/dims + value + status)
- **Classifiers** — structural codelists (id → {code, parent?, metadata})
- **Display** — UI overlay (id-keyed: labels, colors, formatting) — engine never reads

---

## Regional Data
**Path:** `apps/geostat/src/data/regional/raw.ts` (auto-generated from `region.xlsx`)

```typescript
export interface RegionalFact {
  time:    number      // 2010-2024
  geo:     number      // ID: 0=total, 1=tbilisi, 2=adjara, ..., 11=shida_kartli (12 total)
  sector:  number      // ID: 0=_T (total), 1=AGRI, 2=MANUF, ..., 9=OTHER (10 total)
  measure: string      // 'GVA' only
  value:   number      // millions GEL
}

// REGIONAL_CLASSIFIERS: Record<'geo'|'sector'|'time', Classifier>
// geo:    12 entries, hierarchical (parent:0 for all regions)
// sector: 10 entries with display order (sectorOrder: -1 to 8)
// time:   15 years as numeric keys

// REGIONAL_DISPLAY: id → { label, color, [fullLabel, sectorOrder] }
// geo[id]:    Georgian region names + hex colors
// sector[id]: Georgian sector names + colors + order
// time:       empty object (numeric keys as-is)
```

**Dimensions:** geo, sector, time | **Coverage:** ~1485 rows (not all combos present) | **Store:** ExternalStore(REGIONAL_FACTS, classifiers, display)

---

## Accounts (National Accounts Sequence)
**Path:** `apps/geostat/src/data/accounts/raw.ts` (SDMX-aligned)

```typescript
export interface SDMXObservation {
  time:  number
  value: number
  dims: {
    measure:   string   // SDMX codes: P1, P2, B1G, D1, D2-D3, B2G, D4_REC, D4_PAY, B5G, ...
    side:      string   // 'R' (resources) | 'U' (uses)
    account:   string   // 'production'|'income_gen'|'primary_dist'|'secondary_dist'|'use_of_income'|'capital'
    obsStatus: string   // 'A' (actual) | 'p' (preliminary)
    seqPos:    number   // carry-forward chain: 0, 3, 7, 8, 9, 13, 17, 20, -1 (not carry)
  }
}

// ACCOUNTS_FACTS (derived from ACCOUNTS_2025 via adapter)
// 312+ observations (2010–2025, full SNA sequence)
// Accounting identities embedded:
//   P1 − P2 = B1g
//   D1 + D2-D3 + B2g+B3g = B1g
//   B1g + D4r − D4p = B5g
//   B5g + D5r − D5p = B6g
//   B6g − P3 = B8g
//   B8g + D9r − P5 = B9

// ACCOUNTS_CLASSIFIERS
// time:        years array (auto-extracted from facts)
// aggregates:  17 entries (measure codes + isClosing flag)
// account:     6 production/distribution accounts (order + sectionId refs)

// ACCOUNTS_DISPLAY
// aggregates[code]: Georgian measure label + color
// account[code]:    Georgian account title + color + order
```

**Store:** ExternalStore(ACCOUNTS_FACTS, classifiers, display) | **Carry-forward chain:** seqPos encodes T-account sequence for dedup

---

## GDP (Full Macro Dataset)
**Path:** `apps/geostat/src/data/gdp/raw.ts`

```typescript
export interface GDPFact {
  time:      number        // 2010-2025
  measure:   string        // 'GDP_AGRI'|'GDP_IND'|'GDP_CON'|'GDP_SVC'|'GDP_NET_TAX'|...
  value:     number        // millions GEL
  obsStatus: 'A' | 'P'     // actual | preliminary
}

// 336+ observations across 6 sections:
// I.   Production (5): GDP_AGRI, GDP_IND, GDP_CON, GDP_SVC, GDP_NET_TAX
// II.  Expenditure (5): C, I_GFCF, X, M, GDP
// III. Income (4): D1, NET_TAX_PROD, OS_GROSS, MIXED_INC
// IV.  Derived (2): GDP_GROWTH (%), GDP_PER_CAPITA ($)
// V.   Deflator (1): GDP_DEFLATOR (%)
// VI.  GFCF breakdown (5): GFCF_RES, GFCF_STRUCT, GFCF_MACH, GFCF_BIO, GFCF_IP
// VII. NOE share (1): NOE_SHARE (%)

// GDP_CLASSIFIERS
// time:      16 years (2010-2025)
// measure:   22 codes, each tagged with 'approach' attribute
// approach:  8 hierarchies (production, expenditure, income, investment, growth, per_capita, total, noe)

// GDP_DISPLAY
// measure[code]: Georgian label + fullLabel + color (per indicator)
```

**Adapter:** `fromGDPFacts()` — type cast (no logic) | **Special:** Imports (M) stored positive, negated in pipeline

---

## Summary

| Dataset   | Dims                | Facts  | Years       | Hierarchy        | Store            |
|-----------|---------------------|--------|-------------|------------------|------------------|
| Regional  | geo, sector, time   | ~1485  | 2010–2024   | geo parent ref   | ExternalStore    |
| Accounts  | measure, side, acct | ~312   | 2010–2025   | seqPos chain     | ExternalStore    |
| GDP       | measure, time       | ~336   | 2010–2025   | approach order   | ExternalStore    |

**All stored as:** TypeScript exports (raw.ts) → Adapter → Observation[] → ExternalStore (in-memory)
