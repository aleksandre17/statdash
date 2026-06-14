// ── Boundary: SDMXDataset → AccountsFact[] / AccountsFact[] → Observation[] ──
//
//  fromAccountsFacts — typed identity for Layer 1 (static pre-normalized facts).
//  fromSDMX          — wire converter for Layer 2 (API response → AccountsFact[]).
//  CODE_MAP lives here (wire boundary) and in raw.ts (static derivation).

import type { Observation } from '@geostat/engine'
import type { AccountsFact, SDMXDataset } from './raw'

const CODE_MAP: Record<string, string> = {
  'B1g': 'B1G', 'B2g+B3g': 'B2G', 'B5g': 'B5G', 'B6g': 'B6G', 'B8g': 'B8G',
  'D4r': 'D4_REC', 'D4p': 'D4_PAY', 'D5r': 'D5_REC', 'D5p': 'D5_PAY',
  'D9r': 'D9R', 'D2-D3': 'ACC_NET_TAX',
}

export function fromAccountsFacts(facts: readonly AccountsFact[]): Observation[] {
  return facts as unknown as Observation[]
}

// opts.locales: Phase 2 — extract multilingual DSD names into LocaleString classifiers.
// Phase 1: observations only, no DSD names in SDMXDataset → locales unused.
export function fromSDMX(dataset: SDMXDataset, _opts?: { locales?: string[] }): AccountsFact[] {
  return dataset.data.observations.map((o) => ({
    time:    o.time,
    value:   o.value,
    status:  o.dims.obsStatus,
    measure: CODE_MAP[o.dims.measure] ?? o.dims.measure,
    side:    o.dims.side,
    account: o.dims.account,
    seqPos:  o.dims.seqPos,
  }))
}