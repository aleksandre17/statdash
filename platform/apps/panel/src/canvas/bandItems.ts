// ── bandItems — thin alias of the ENGINE value-band reading (ADR-041 · Phase 2) ──
//
//  The declaration-driven value-band enumeration (BE-1) was PROMOTED engine-side
//  (`@statdash/react/engine` → `bandItems.ts`) as the pure kernel of the `value`
//  `PartSource` (`valueParts`). This app module is now a byte-identical re-export so
//  every existing `./bandItems` call site (`bandFieldsOf`/`bandItemsOf`/`BandItemRef`)
//  is unchanged — one reading, engine-owned, the Part port routes through it.
//
export { bandFieldsOf, bandItemsOf } from '@statdash/react/engine'
export type { BandItemRef } from '@statdash/react/engine'
