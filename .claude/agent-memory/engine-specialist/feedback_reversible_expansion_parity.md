---
name: engine-reversible-expansion-parity
description: The reversible-expansion discipline — prove a core generalization safe by byte-identical parity of the pre-existing (narrower) path
metadata:
  type: feedback
---

When generalizing an engine capability (scalar → grain, single-store → multi-store, etc.), structure it as a REVERSIBLE EXPANSION and prove safety by BYTE-IDENTICAL PARITY of the narrow pre-existing path — not a rewrite.

**Why:** this platform's whole rearchitecture proceeds on "reversible expansion, one-way doors held for the owner." A generalization that changes existing outputs is a one-way door; one that keeps the old path byte-identical is git-revertable and needs no sign-off. The DoD's #1 slip is a false-green typecheck (`tsc -b --force` at root, paste the real result) or a claimed parity that isn't actually byte-identical.

**How to apply:** make the narrow case a literal delegation to the existing SSOT. AR-50 M2: `evalCalcAtGrain(ref, ctx, store, grain=[])` at grain-∅ delegates to the untouched scalar `resolveMetricValue`, so a KPI point read cannot move (FF-CALC-GRAIN-SCALAR-IDENTICAL). Reuse the existing value seam for every new cell too (M2 reads every grain cell via `storeValAt`, the OLAP-cell seam scalar already used) — so "one governed number" holds across scalar and grain. Write the parity as an executable fitness test, not a claim. Also hard-gate: single dialect (`@statdash/expr`, never a second evaluator), the dependency arrow (`contracts←expr←core`), and Law 1 (grain is a generic dim-key set, never `time`-special). See [[ar50-semantic-layer]].
