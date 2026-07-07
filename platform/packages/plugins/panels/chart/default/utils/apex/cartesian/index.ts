// ── Cartesian builder — public seam ────────────────────────────────────
//
//  Preserves the `./cartesian` import path byte-identically across the
//  AR-45 directory split (`toApexOptions` + the 6 apex driver tests import
//  `buildCartesian` from here). The assembler lives in `./build`.
//
export { buildCartesian } from './build'
