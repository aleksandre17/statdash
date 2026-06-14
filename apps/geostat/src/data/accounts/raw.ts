// ── SDMX-JSON static dataset — national accounts sequence (2025) ──────
//
//  Simulates the response from Spring / Geostat API.
//  Field layout follows SDMX-JSON 1.0: meta + data.observations.
//
//  Each observation is already normalized by the Java backend:
//    - R/U split performed (one obs per side)
//    - Indicator codes extracted from labels
//    - Account IDs mapped (Georgian → stable code)
//    - seqPos embedded in dims (carry-forward chain position; -1 = non-carry)
//
//  Frontend responsibility: fromSDMX() structural unwrap ONLY — zero logic.
//  All business rules (code extraction, account mapping, sequence) live in Java.
//
//  Display data (labels, colors) lives in ACCOUNTS_DISPLAY — joined at query time.
//  Structural metadata (isClosing, order) lives in ACCOUNTS_CLASSIFIERS — joined at query time.
//  Facts contain only foreign keys + time + value + status + seqPos.
//
//  Migration path: replace this file with a live fetch → fromSDMX → ExternalStore.
//  No other file changes.
//

export interface SDMXObservationDims {
  measure:   string   // SDMX indicator code: 'P1', 'B1g', 'D1', ...
  side:      string   // 'R' (resources) | 'U' (uses)
  account:   string   // stable ID: 'production' | 'income_gen' | ...
  obsStatus: string   // 'A' = normal, 'p' = preliminary, 'e' = estimate, 'r' = revised
  seqPos:    number   // carry-forward sequence position; -1 = not a carry-forward item
}

export interface SDMXObservation {
  time:  number
  value: number
  dims:  SDMXObservationDims
}

export interface SDMXDataset {
  meta: {
    id:       string
    prepared: string   // ISO 8601 date
    sender:   string
  }
  data: {
    observations: SDMXObservation[]
  }
}

// ── Static dataset (2025) ─────────────────────────────────────────────

export const ACCOUNTS_2025: SDMXDataset = {
  meta: {
    id:       'NATIONAL_ACCOUNTS_SEQUENCE',
    prepared: '2025-01-01',
    sender:   'Geostat',
  },
  data: {
    observations: [
      // ── I. Production account ─────────────────────────────────────────
      { time: 2025, value: 178837.27566923446,  dims: { measure: 'P1',      side: 'R', account: 'production',     obsStatus: 'A', seqPos:  0 } },
      { time: 2025, value:  74239.13578590246,  dims: { measure: 'P2',      side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2025, value: 104598.139883332,    dims: { measure: 'B1g',     side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },

      // ── II. Income generation account ─────────────────────────────────
      { time: 2025, value: 104598.139883332,    dims: { measure: 'B1g',     side: 'R', account: 'income_gen',     obsStatus: 'A', seqPos:  3 } },
      { time: 2025, value:  34816.26771433034,  dims: { measure: 'D1',      side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2025, value:  13830.947586718112, dims: { measure: 'D2-D3',   side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2025, value:  55950.924582283566, dims: { measure: 'B2g+B3g', side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },

      // ── III. Primary income distribution ──────────────────────────────
      { time: 2025, value:  55950.924582283566, dims: { measure: 'B2g+B3g', side: 'R', account: 'primary_dist',   obsStatus: 'A', seqPos:  7 } },
      { time: 2025, value:  34816.26771433034,  dims: { measure: 'D1',      side: 'R', account: 'primary_dist',   obsStatus: 'A', seqPos:  8 } },
      { time: 2025, value:  13830.947586718112, dims: { measure: 'D2-D3',   side: 'R', account: 'primary_dist',   obsStatus: 'A', seqPos:  9 } },
      { time: 2025, value:   4934.652980987907, dims: { measure: 'D4r',     side: 'R', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2025, value:  11497.529457157492, dims: { measure: 'D4p',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2025, value:  98035.26340716243,  dims: { measure: 'B5g',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },

      // ── IV. Secondary income distribution ─────────────────────────────
      { time: 2025, value:  98035.26340716243,  dims: { measure: 'B5g',     side: 'R', account: 'secondary_dist', obsStatus: 'A', seqPos: 13 } },
      { time: 2025, value:  10158.03007440071,  dims: { measure: 'D5r',     side: 'R', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2025, value:    412.4646677096025,dims: { measure: 'D5p',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2025, value: 107780.82881385353,  dims: { measure: 'B6g',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },

      // ── V. Use of income account ───────────────────────────────────────
      { time: 2025, value: 107780.82881385353,  dims: { measure: 'B6g',     side: 'R', account: 'use_of_income',  obsStatus: 'A', seqPos: 17 } },
      { time: 2025, value:  88425.60255782693,  dims: { measure: 'P3',      side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: -1 } },
      { time: 2025, value:  19355.226256026603, dims: { measure: 'B8g',     side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: 20 } },

      // ── VI. Capital account ────────────────────────────────────────────
      { time: 2025, value:  19355.226256026603, dims: { measure: 'B8g',     side: 'R', account: 'capital',        obsStatus: 'A', seqPos: 20 } },
      { time: 2025, value:     65.60506452301973,dims:{ measure: 'D9r',     side: 'R', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2025, value:  22256.714798751065, dims: { measure: 'P5',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2025, value:  -2835.8834782014455,dims:{ measure: 'B9',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },

      // ── Historical SNA chain — all indicators (2010–2024) ────────────
      //
      //  Range-mode pivot source: full SNA sequence across years.
      //  isCarryForward is derived in ACCOUNTS_FACTS: side === 'R' && seqPos > 0.
      //  Accounting identities verified for each year:
      //    P1 − P2 = B1g  ·  D1 + D2-D3 + B2g+B3g = B1g
      //    B1g + D4r − D4p = B5g  ·  B5g + D5r − D5p = B6g
      //    B6g − P3 = B8g  ·  B8g + D9r − P5 = B9
      //

      // ── I. Production ──────────────────────────────────────────────────
      { time: 2010, value:  36749.9, dims: { measure: 'P1',      side: 'R', account: 'production',     obsStatus: 'A', seqPos:  0 } },
      { time: 2011, value:  45126.8, dims: { measure: 'P1',      side: 'R', account: 'production',     obsStatus: 'A', seqPos:  0 } },
      { time: 2012, value:  48735.5, dims: { measure: 'P1',      side: 'R', account: 'production',     obsStatus: 'A', seqPos:  0 } },
      { time: 2013, value:  49034.1, dims: { measure: 'P1',      side: 'R', account: 'production',     obsStatus: 'A', seqPos:  0 } },
      { time: 2014, value:  53715.7, dims: { measure: 'P1',      side: 'R', account: 'production',     obsStatus: 'A', seqPos:  0 } },
      { time: 2015, value:  58319.8, dims: { measure: 'P1',      side: 'R', account: 'production',     obsStatus: 'A', seqPos:  0 } },
      { time: 2016, value:  63736.2, dims: { measure: 'P1',      side: 'R', account: 'production',     obsStatus: 'A', seqPos:  0 } },
      { time: 2017, value:  70261.8, dims: { measure: 'P1',      side: 'R', account: 'production',     obsStatus: 'A', seqPos:  0 } },
      { time: 2018, value:  77139.3, dims: { measure: 'P1',      side: 'R', account: 'production',     obsStatus: 'A', seqPos:  0 } },
      { time: 2019, value:  85862.1, dims: { measure: 'P1',      side: 'R', account: 'production',     obsStatus: 'A', seqPos:  0 } },
      { time: 2020, value:  84500,   dims: { measure: 'P1',      side: 'R', account: 'production',     obsStatus: 'A', seqPos:  0 } },
      { time: 2021, value: 103149,   dims: { measure: 'P1',      side: 'R', account: 'production',     obsStatus: 'A', seqPos:  0 } },
      { time: 2022, value: 123587,   dims: { measure: 'P1',      side: 'R', account: 'production',     obsStatus: 'A', seqPos:  0 } },
      { time: 2023, value: 137604,   dims: { measure: 'P1',      side: 'R', account: 'production',     obsStatus: 'A', seqPos:  0 } },
      { time: 2024, value: 160360,   dims: { measure: 'P1',      side: 'R', account: 'production',     obsStatus: 'A', seqPos:  0 } },
      { time: 2010, value:  14601.2, dims: { measure: 'P2',      side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2011, value:  19027.5, dims: { measure: 'P2',      side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2012, value:  20838.7, dims: { measure: 'P2',      side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2013, value:  19896.4, dims: { measure: 'P2',      side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2014, value:  21993.3, dims: { measure: 'P2',      side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2015, value:  23771.6, dims: { measure: 'P2',      side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2016, value:  27182.9, dims: { measure: 'P2',      side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2017, value:  28922.1, dims: { measure: 'P2',      side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2018, value:  31765.0, dims: { measure: 'P2',      side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2019, value:  36135.8, dims: { measure: 'P2',      side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2020, value:  35093,   dims: { measure: 'P2',      side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2021, value:  42828,   dims: { measure: 'P2',      side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2022, value:  51314,   dims: { measure: 'P2',      side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2023, value:  57134,   dims: { measure: 'P2',      side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2024, value:  66582,   dims: { measure: 'P2',      side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2010, value:  22148.7, dims: { measure: 'B1g',     side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2011, value:  26099.4, dims: { measure: 'B1g',     side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2012, value:  27896.9, dims: { measure: 'B1g',     side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2013, value:  29137.7, dims: { measure: 'B1g',     side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2014, value:  31722.4, dims: { measure: 'B1g',     side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2015, value:  34548.2, dims: { measure: 'B1g',     side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2016, value:  36553.3, dims: { measure: 'B1g',     side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2017, value:  41339.8, dims: { measure: 'B1g',     side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2018, value:  45374.4, dims: { measure: 'B1g',     side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2019, value:  49726.3, dims: { measure: 'B1g',     side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2020, value:  49407,   dims: { measure: 'B1g',     side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2021, value:  60321,   dims: { measure: 'B1g',     side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2022, value:  72273,   dims: { measure: 'B1g',     side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2023, value:  80470,   dims: { measure: 'B1g',     side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },
      { time: 2024, value:  93778,   dims: { measure: 'B1g',     side: 'U', account: 'production',     obsStatus: 'A', seqPos: -1 } },

      // ── II. Income generation ──────────────────────────────────────────
      { time: 2010, value:   4998.7, dims: { measure: 'D1',      side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2011, value:   6225.1, dims: { measure: 'D1',      side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2012, value:   7084.0, dims: { measure: 'D1',      side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2013, value:   7799.8, dims: { measure: 'D1',      side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2014, value:   8549.9, dims: { measure: 'D1',      side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2015, value:   9712.0, dims: { measure: 'D1',      side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2016, value:  11061.6, dims: { measure: 'D1',      side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2017, value:  12580.7, dims: { measure: 'D1',      side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2018, value:  14171.9, dims: { measure: 'D1',      side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2019, value:  16241.9, dims: { measure: 'D1',      side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2020, value:  22000,   dims: { measure: 'D1',      side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2021, value:  26000,   dims: { measure: 'D1',      side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2022, value:  29000,   dims: { measure: 'D1',      side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2023, value:  32000,   dims: { measure: 'D1',      side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2024, value:  31200,   dims: { measure: 'D1',      side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2010, value:   2822.9, dims: { measure: 'D2-D3',   side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2011, value:   3205.3, dims: { measure: 'D2-D3',   side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2012, value:   3382.4, dims: { measure: 'D2-D3',   side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2013, value:   3513.4, dims: { measure: 'D2-D3',   side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2014, value:   3982.3, dims: { measure: 'D2-D3',   side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2015, value:   4255.8, dims: { measure: 'D2-D3',   side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2016, value:   4841.0, dims: { measure: 'D2-D3',   side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2017, value:   6018.4, dims: { measure: 'D2-D3',   side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2018, value:   6446.8, dims: { measure: 'D2-D3',   side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2019, value:   6705.4, dims: { measure: 'D2-D3',   side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2020, value:   5407,   dims: { measure: 'D2-D3',   side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2021, value:   6321,   dims: { measure: 'D2-D3',   side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2022, value:   9273,   dims: { measure: 'D2-D3',   side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2023, value:  10470,   dims: { measure: 'D2-D3',   side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2024, value:  11200,   dims: { measure: 'D2-D3',   side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2010, value:  14327.0, dims: { measure: 'B2g+B3g', side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2011, value:  16669.0, dims: { measure: 'B2g+B3g', side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2012, value:  17430.5, dims: { measure: 'B2g+B3g', side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2013, value:  17824.6, dims: { measure: 'B2g+B3g', side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2014, value:  19190.3, dims: { measure: 'B2g+B3g', side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2015, value:  20580.3, dims: { measure: 'B2g+B3g', side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2016, value:  20650.7, dims: { measure: 'B2g+B3g', side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2017, value:  22740.7, dims: { measure: 'B2g+B3g', side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2018, value:  24755.6, dims: { measure: 'B2g+B3g', side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2019, value:  26779.0, dims: { measure: 'B2g+B3g', side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2020, value:  22000,   dims: { measure: 'B2g+B3g', side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2021, value:  28000,   dims: { measure: 'B2g+B3g', side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2022, value:  34000,   dims: { measure: 'B2g+B3g', side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2023, value:  38000,   dims: { measure: 'B2g+B3g', side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },
      { time: 2024, value:  51378,   dims: { measure: 'B2g+B3g', side: 'U', account: 'income_gen',     obsStatus: 'A', seqPos: -1 } },

      // ── III. Primary distribution ──────────────────────────────────────
      { time: 2010, value:    992.6, dims: { measure: 'D4r',     side: 'R', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2011, value:   1275.1, dims: { measure: 'D4r',     side: 'R', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2012, value:   1778.8, dims: { measure: 'D4r',     side: 'R', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2013, value:   1535.4, dims: { measure: 'D4r',     side: 'R', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2014, value:   1813.6, dims: { measure: 'D4r',     side: 'R', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2015, value:   1912.0, dims: { measure: 'D4r',     side: 'R', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2016, value:   2159.1, dims: { measure: 'D4r',     side: 'R', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2017, value:   2832.7, dims: { measure: 'D4r',     side: 'R', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2018, value:   3251.9, dims: { measure: 'D4r',     side: 'R', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2019, value:   3884.9, dims: { measure: 'D4r',     side: 'R', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2020, value:   2322,   dims: { measure: 'D4r',     side: 'R', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2021, value:   2835,   dims: { measure: 'D4r',     side: 'R', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2022, value:   3397,   dims: { measure: 'D4r',     side: 'R', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2023, value:   3782,   dims: { measure: 'D4r',     side: 'R', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2024, value:   4408,   dims: { measure: 'D4r',     side: 'R', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2010, value:   1379.4, dims: { measure: 'D4p',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2011, value:   1993.5, dims: { measure: 'D4p',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2012, value:   2063.4, dims: { measure: 'D4p',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2013, value:   2062.3, dims: { measure: 'D4p',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2014, value:   2216.6, dims: { measure: 'D4p',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2015, value:   2691.3, dims: { measure: 'D4p',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2016, value:   3814.8, dims: { measure: 'D4p',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2017, value:   4818.2, dims: { measure: 'D4p',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2018, value:   4960.7, dims: { measure: 'D4p',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2019, value:   6130.0, dims: { measure: 'D4p',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2020, value:   5435,   dims: { measure: 'D4p',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2021, value:   6635,   dims: { measure: 'D4p',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2022, value:   7950,   dims: { measure: 'D4p',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2023, value:   8852,   dims: { measure: 'D4p',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2024, value:  10316,   dims: { measure: 'D4p',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2010, value:  21761.8, dims: { measure: 'B5g',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2011, value:  25381.0, dims: { measure: 'B5g',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2012, value:  27612.3, dims: { measure: 'B5g',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2013, value:  28610.8, dims: { measure: 'B5g',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2014, value:  31319.4, dims: { measure: 'B5g',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2015, value:  33768.8, dims: { measure: 'B5g',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2016, value:  34897.7, dims: { measure: 'B5g',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2017, value:  39354.3, dims: { measure: 'B5g',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2018, value:  43665.5, dims: { measure: 'B5g',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2019, value:  47481.1, dims: { measure: 'B5g',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2020, value:  46294,   dims: { measure: 'B5g',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2021, value:  56521,   dims: { measure: 'B5g',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2022, value:  67720,   dims: { measure: 'B5g',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2023, value:  75400,   dims: { measure: 'B5g',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },
      { time: 2024, value:  87870,   dims: { measure: 'B5g',     side: 'U', account: 'primary_dist',   obsStatus: 'A', seqPos: -1 } },

      // ── IV. Secondary distribution ─────────────────────────────────────
      { time: 2010, value:   2108.3, dims: { measure: 'D5r',     side: 'R', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2011, value:   2454.5, dims: { measure: 'D5r',     side: 'R', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2012, value:   2504.7, dims: { measure: 'D5r',     side: 'R', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2013, value:   2612.7, dims: { measure: 'D5r',     side: 'R', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2014, value:   2755.1, dims: { measure: 'D5r',     side: 'R', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2015, value:   2763.8, dims: { measure: 'D5r',     side: 'R', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2016, value:   2916.1, dims: { measure: 'D5r',     side: 'R', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2017, value:   3511.9, dims: { measure: 'D5r',     side: 'R', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2018, value:   3810.9, dims: { measure: 'D5r',     side: 'R', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2019, value:   4344.4, dims: { measure: 'D5r',     side: 'R', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2020, value:   4815,   dims: { measure: 'D5r',     side: 'R', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2021, value:   5878,   dims: { measure: 'D5r',     side: 'R', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2022, value:   7043,   dims: { measure: 'D5r',     side: 'R', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2023, value:   7842,   dims: { measure: 'D5r',     side: 'R', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2024, value:   9138,   dims: { measure: 'D5r',     side: 'R', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2010, value:    151.7, dims: { measure: 'D5p',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2011, value:    217.9, dims: { measure: 'D5p',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2012, value:    178.9, dims: { measure: 'D5p',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2013, value:    198.1, dims: { measure: 'D5p',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2014, value:    239.4, dims: { measure: 'D5p',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2015, value:    230.8, dims: { measure: 'D5p',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2016, value:    264.0, dims: { measure: 'D5p',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2017, value:    311.3, dims: { measure: 'D5p',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2018, value:    353.3, dims: { measure: 'D5p',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2019, value:    463.7, dims: { measure: 'D5p',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2020, value:    185,   dims: { measure: 'D5p',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2021, value:    226,   dims: { measure: 'D5p',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2022, value:    271,   dims: { measure: 'D5p',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2023, value:    302,   dims: { measure: 'D5p',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2024, value:    351,   dims: { measure: 'D5p',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2010, value:  23718.4, dims: { measure: 'B6g',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2011, value:  27617.6, dims: { measure: 'B6g',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2012, value:  29938.1, dims: { measure: 'B6g',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2013, value:  31025.5, dims: { measure: 'B6g',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2014, value:  33835.1, dims: { measure: 'B6g',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2015, value:  36301.7, dims: { measure: 'B6g',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2016, value:  37549.8, dims: { measure: 'B6g',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2017, value:  42554.9, dims: { measure: 'B6g',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2018, value:  47123.1, dims: { measure: 'B6g',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2019, value:  51361.8, dims: { measure: 'B6g',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2020, value:  50924,   dims: { measure: 'B6g',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2021, value:  62173,   dims: { measure: 'B6g',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2022, value:  74492,   dims: { measure: 'B6g',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2023, value:  82940,   dims: { measure: 'B6g',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },
      { time: 2024, value:  96657,   dims: { measure: 'B6g',     side: 'U', account: 'secondary_dist', obsStatus: 'A', seqPos: -1 } },

      // ── V. Use of income ───────────────────────────────────────────────
      { time: 2010, value:  21220.5, dims: { measure: 'P3',      side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: -1 } },
      { time: 2011, value:  24694.8, dims: { measure: 'P3',      side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: -1 } },
      { time: 2012, value:  25784.5, dims: { measure: 'P3',      side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: -1 } },
      { time: 2013, value:  26291.2, dims: { measure: 'P3',      side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: -1 } },
      { time: 2014, value:  28847.3, dims: { measure: 'P3',      side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: -1 } },
      { time: 2015, value:  31046.6, dims: { measure: 'P3',      side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: -1 } },
      { time: 2016, value:  31444.9, dims: { measure: 'P3',      side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: -1 } },
      { time: 2017, value:  35430.8, dims: { measure: 'P3',      side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: -1 } },
      { time: 2018, value:  37447.7, dims: { measure: 'P3',      side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: -1 } },
      { time: 2019, value:  40792.1, dims: { measure: 'P3',      side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: -1 } },
      { time: 2020, value:  41758,   dims: { measure: 'P3',      side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: -1 } },
      { time: 2021, value:  50982,   dims: { measure: 'P3',      side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: -1 } },
      { time: 2022, value:  61083,   dims: { measure: 'P3',      side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: -1 } },
      { time: 2023, value:  68011,   dims: { measure: 'P3',      side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: -1 } },
      { time: 2024, value:  79259,   dims: { measure: 'P3',      side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: -1 } },
      { time: 2010, value:   2498.0, dims: { measure: 'B8g',     side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: 20 } },
      { time: 2011, value:   2922.8, dims: { measure: 'B8g',     side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: 20 } },
      { time: 2012, value:   4153.6, dims: { measure: 'B8g',     side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: 20 } },
      { time: 2013, value:   4734.3, dims: { measure: 'B8g',     side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: 20 } },
      { time: 2014, value:   4987.8, dims: { measure: 'B8g',     side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: 20 } },
      { time: 2015, value:   5255.1, dims: { measure: 'B8g',     side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: 20 } },
      { time: 2016, value:   6104.9, dims: { measure: 'B8g',     side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: 20 } },
      { time: 2017, value:   7124.1, dims: { measure: 'B8g',     side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: 20 } },
      { time: 2018, value:   9675.5, dims: { measure: 'B8g',     side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: 20 } },
      { time: 2019, value:  10569.7, dims: { measure: 'B8g',     side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: 20 } },
      { time: 2020, value:   9166,   dims: { measure: 'B8g',     side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: 20 } },
      { time: 2021, value:  11191,   dims: { measure: 'B8g',     side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: 20 } },
      { time: 2022, value:  13409,   dims: { measure: 'B8g',     side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: 20 } },
      { time: 2023, value:  14929,   dims: { measure: 'B8g',     side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: 20 } },
      { time: 2024, value:  17398,   dims: { measure: 'B8g',     side: 'U', account: 'use_of_income',  obsStatus: 'A', seqPos: 20 } },

      // ── VI. Capital ────────────────────────────────────────────────────
      { time: 2010, value:    354.5, dims: { measure: 'D9r',     side: 'R', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2011, value:    247.7, dims: { measure: 'D9r',     side: 'R', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2012, value:    217.4, dims: { measure: 'D9r',     side: 'R', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2013, value:    220.5, dims: { measure: 'D9r',     side: 'R', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2014, value:    188.4, dims: { measure: 'D9r',     side: 'R', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2015, value:    132.0, dims: { measure: 'D9r',     side: 'R', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2016, value:    133.3, dims: { measure: 'D9r',     side: 'R', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2017, value:    208.4, dims: { measure: 'D9r',     side: 'R', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2018, value:    194.4, dims: { measure: 'D9r',     side: 'R', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2019, value:    131.2, dims: { measure: 'D9r',     side: 'R', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2020, value:     60,   dims: { measure: 'D9r',     side: 'R', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2021, value:     60,   dims: { measure: 'D9r',     side: 'R', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2022, value:     60,   dims: { measure: 'D9r',     side: 'R', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2023, value:     60,   dims: { measure: 'D9r',     side: 'R', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2024, value:     60,   dims: { measure: 'D9r',     side: 'R', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2010, value:   4635.6, dims: { measure: 'P5',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2011, value:   6034.3, dims: { measure: 'P5',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2012, value:   7260.9, dims: { measure: 'P5',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2013, value:   6323.0, dims: { measure: 'P5',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2014, value:   8136.8, dims: { measure: 'P5',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2015, value:   9285.5, dims: { measure: 'P5',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2016, value:  10565.0, dims: { measure: 'P5',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2017, value:  10386.6, dims: { measure: 'P5',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2018, value:  12671.3, dims: { measure: 'P5',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2019, value:  13509.7, dims: { measure: 'P5',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2020, value:  10847,   dims: { measure: 'P5',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2021, value:  13193,   dims: { measure: 'P5',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2022, value:  15729,   dims: { measure: 'P5',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2023, value:  17644,   dims: { measure: 'P5',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2024, value:  20593,   dims: { measure: 'P5',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2010, value:  -1783.1, dims: { measure: 'B9',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2011, value:  -2863.8, dims: { measure: 'B9',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2012, value:  -2889.9, dims: { measure: 'B9',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2013, value:  -1368.2, dims: { measure: 'B9',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2014, value:  -2960.6, dims: { measure: 'B9',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2015, value:  -3898.4, dims: { measure: 'B9',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2016, value:  -4326.8, dims: { measure: 'B9',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2017, value:  -3054.1, dims: { measure: 'B9',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2018, value:  -2801.5, dims: { measure: 'B9',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2019, value:  -2808.8, dims: { measure: 'B9',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2020, value:  -1621,   dims: { measure: 'B9',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2021, value:  -1942,   dims: { measure: 'B9',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2022, value:  -2260,   dims: { measure: 'B9',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2023, value:  -2655,   dims: { measure: 'B9',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
      { time: 2024, value:  -3135,   dims: { measure: 'B9',      side: 'U', account: 'capital',        obsStatus: 'A', seqPos: -1 } },
    ],
  },
}

// ── DataBundle — AccountsFact · ACCOUNTS_CLASSIFIERS · ACCOUNTS_DISPLAY ──

const _CODE_MAP: Record<string, string> = {
  'B1g': 'B1G', 'B2g+B3g': 'B2G', 'B5g': 'B5G', 'B6g': 'B6G', 'B8g': 'B8G',
  'D4r': 'D4_REC', 'D4p': 'D4_PAY', 'D5r': 'D5_REC', 'D5p': 'D5_PAY',
  'D9r': 'D9R', 'D2-D3': 'ACC_NET_TAX',
}

// Pure facts: foreign keys + time + value + status + seqPos.
// Structural metadata (isClosing, order) comes from classifiers via join at query time.
// Display data (label, color) comes from ACCOUNTS_DISPLAY via lookup at query time.
// Derived flags (isCarryForward) computed in query pipe via derive op — not stored.
export interface AccountsFact {
  time:    number
  value:   number
  status:  string   // obsStatus: 'A' | 'p' | 'e' | 'r'
  measure: string   // id → ACCOUNTS_CLASSIFIERS.measure
  side:    string   // 'R' | 'U'
  account: string   // id → ACCOUNTS_CLASSIFIERS.account
  seqPos:  number   // carry-forward chain position; -1 = not a carry-forward
}

export const ACCOUNTS_FACTS: readonly AccountsFact[] = ACCOUNTS_2025.data.observations.map((o) => ({
  time:    o.time,
  value:   o.value,
  status:  o.dims.obsStatus,
  measure: _CODE_MAP[o.dims.measure] ?? o.dims.measure,
  side:    o.dims.side,
  account: o.dims.account,
  seqPos:  o.dims.seqPos,
}))

export const ACCOUNTS_CLASSIFIERS = {
  time: [...new Set(ACCOUNTS_FACTS.map((f) => f.time))].sort((a, b) => a - b)
    .map((y) => ({ code: y })),

  aggregates: [
    { code: 'P1',          account: 'production',     isClosing: 0 },
    { code: 'P2',          account: 'production',     isClosing: 0 },
    { code: 'B1G',         account: 'production',     isClosing: 1 },
    { code: 'D1',          account: 'income_gen',     isClosing: 0 },
    { code: 'ACC_NET_TAX', account: 'income_gen',     isClosing: 0 },
    { code: 'B2G',         account: 'income_gen',     isClosing: 1 },
    { code: 'D4_REC',      account: 'primary_dist',   isClosing: 0 },
    { code: 'D4_PAY',      account: 'primary_dist',   isClosing: 0 },
    { code: 'B5G',         account: 'primary_dist',   isClosing: 1 },
    { code: 'D5_REC',      account: 'secondary_dist', isClosing: 0 },
    { code: 'D5_PAY',      account: 'secondary_dist', isClosing: 0 },
    { code: 'B6G',         account: 'secondary_dist', isClosing: 1 },
    { code: 'P3',          account: 'use_of_income',  isClosing: 0 },
    { code: 'B8G',         account: 'use_of_income',  isClosing: 1 },
    { code: 'D9R',         account: 'capital',        isClosing: 0 },
    { code: 'P5',          account: 'capital',        isClosing: 0 },
    { code: 'B9',          account: 'capital',        isClosing: 1 },
  ],

  account: [
    { code: 'production',     order: 0, sectionId: 'production-account'     },
    { code: 'income_gen',     order: 1, sectionId: 'income-formation'       },
    { code: 'primary_dist',   order: 2, sectionId: 'primary-distribution'   },
    { code: 'secondary_dist', order: 3, sectionId: 'secondary-distribution' },
    { code: 'use_of_income',  order: 4, sectionId: undefined                },
    { code: 'capital',        order: 5, sectionId: 'capital-account'        },
  ],
}

export const ACCOUNTS_DISPLAY = {
  aggregates: {
    P1:          { label: 'გამოშვება საბაზრო ფასებში',                         color: '#5470c6' },
    P2:          { label: 'შუალედური მოხმარება',                                color: '#a0b4e8' },
    B1G:         { label: 'მთლიანი შიდა პროდუქტი საბაზრო ფასებში',             color: '#5470c6' },
    D1:          { label: 'შრომის ანაზღაურება',                                 color: '#3ba272' },
    ACC_NET_TAX: { label: 'გადასახადები-სუბსიდიები',                            color: '#73c0de' },
    B2G:         { label: 'მთლიანი შერეული შემოსავალი + საოპერაციო მოგება',    color: '#3ba272' },
    D4_REC:      { label: 'პირველადი შემოსავლების მიღება',                      color: '#fac858' },
    D4_PAY:      { label: 'პირველადი შემოსავლების გადახდა',                     color: '#ee6666' },
    B5G:         { label: 'მთლიანი ეროვნული შემოსავალი',                       color: '#fac858' },
    D5_REC:      { label: 'მიმდინარე ტრანსფერების მიღება',                     color: '#9a60b4' },
    D5_PAY:      { label: 'მიმდინარე ტრანსფერების გადახდა',                    color: '#ee6666' },
    B6G:         { label: 'მთლიანი განკარგვადი შემოსავალი',                    color: '#9a60b4' },
    P3:          { label: 'საბოლოო მოხმარება',                                 color: '#fc8452' },
    B8G:         { label: 'მთლიანი დანაზოგი',                                  color: '#fc8452' },
    D9R:         { label: 'კაპიტალური ტრანსფერების მიღება',                    color: '#91cc75' },
    P5:          { label: 'მთლიანი კაპიტალის ფორმირება',                       color: '#ea7ccc' },
    B9:          { label: 'წმინდა დაკრედიტება (+), წმინდა სესხება(-)',         color: '#ee6666' },
  },
  account: {
    production:     { label: 'I. წარმოების ანგარიში',                  color: '#5470c6', order: 0 },
    income_gen:     { label: 'II. შემოსავლების ფორმირების ანგარიში',    color: '#3ba272', order: 1 },
    primary_dist:   { label: 'III. პირველადი შემოსავლების განაწილება',  color: '#fac858', order: 2 },
    secondary_dist: { label: 'IV. შემოსავლების მეორადი განაწილება',     color: '#9a60b4', order: 3 },
    use_of_income:  { label: 'V. შემოსავლის გამოყენების ანგარიში',      color: '#fc8452', order: 4 },
    capital:        { label: 'VI. კაპიტალის ანგარიში',                  color: '#91cc75', order: 5 },
  },
}