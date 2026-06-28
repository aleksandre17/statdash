# DESIGN 2 — The grain / store-port frontier (`valAt` point-read + generic grain model)

> Status: ARCHITECT-GATED → **READY TO BUILD**. Design-only (no product code touched).
> Author: architect (Opus). The **highest-leverage engine unlock** — one primitive unblocks four stalled items.
> Laws in play: **Law 1** (grain is generic, never time-privileged), **Law 2** (declarative, no functions), **Law 3** (core pure; manifest/stores live in react), **Law 4** (adopt OLAP/Cube/Malloy grain *whole*), **Law 8** (one extension path).

---

## 1. The one root behind four stalled items

| Item | Symptom | The shared root |
|---|---|---|
| **ENG-02/07/08** desugar val-cell specs | `desugar` (`packages/core/src/data/desugar.ts`) can lower `pivot` but **not** `timeseries`/`growth`/`ratio-list` | Those 3 resolvers (`packages/core/src/registry/resolvers.ts`) do **imperative point reads**: `storeVal(store, code, atTime(y, ctx))` — read measure `code` at the coordinate `{time:y}`. There is **no declarative primitive** that expresses "read `code` at coordinate X" as data, so the loop can't be lowered to a config spec. |
| **blend B2** cross-grain join | deferred (`adr_data_blending_decision`) | `resolveBlends` (`packages/react/src/engine/resolveNodeRows.ts`) joins primary×secondary on a shared dim **at the same grain** only. No vocabulary to request the secondary *rolled up to the primary's grain*. |
| **timeDimension.granularity decorative** | `resolveTimeDimension` carries `granularity` but the comment says it "does not affect resolution in this pass — door for LOD" (`packages/core/src/core/time-dimension.ts:124`) | No rollup machinery behind the grain field. |
| **DC-03** pre-aggregations / rollup-routing | wants a cost-based grain planner (`work/scan/data-concepts.md`) | No grain-aware port to route *at*, and no correctness contract tying a pre-agg to the raw rollup. |

**Root:** the `DataStore` port (`packages/core/src/data/store.ts`) has `val` (read at `ctx.dims`) and `obs` (multi-row), but **no declarative point-read addressed by an explicit coordinate + grain**. `atTime` (`packages/core/src/core/context.ts:105`) achieves the coordinate by *cloning ctx* — an imperative move invisible to config. The `_val` aggregation (`store-impl.ts:267`) already **sums all obs matching the coordinate** — i.e. it *already* does an implicit grain-rollup (pin `time=2020` over quarterly data → annual sum). The grain is real but **undeclared and unaddressable**.

**The fix is one primitive:** a **`valAt` point-read at the store port**, addressed by a *generic* coordinate + *generic* grain. It makes the implicit explicit, declarative (Law 2), and generic (Law 1) — and unblocks all four.

---

## 2. Recommended approach

Add **`valAt`** to the store port and a **generic grain model** (grain = a per-dim attribute, never time-special). Then desugar the 3 val-cell specs onto `valAt`, thread `granularity` into it, extend `blend` with a grain, and put a **rollup-router below the port** with a **raw-fallback correctness twin**.

Primitive set after this work (note the clean split):
- **store-aware primitives:** `query` (obs rows) · **`point-series`** (NEW — a fan-out of `valAt` point reads).
- **store-free primitive:** `transform` (pure pipe).
- **convenience specs** (`timeseries`/`growth`/`ratio-list`/`pivot`) **desugar** to the above. This keeps "the SINGLE extension path is the resolver registry" (Law 8) and shrinks 3 bespoke resolvers to one generic one + existing transform ops.

Why `point-series` rather than "desugar straight to `transform`": a timeseries needs (a) coordinate **enumeration** (`distinct` on the series dim) and (b) a **summed point read per coordinate** — both require the store. The pure `transform` pipe has no store (`PipelineContext` carries classifiers/display/section, not a store — `transform/types.ts:355`). So `point-series` is the genuinely-needed store-aware lowering target, analogous to how `query` is store-aware and `transform` is not.

---

## 3. Exact seam / types

### 3.1 Port extension — `valAt` (additive to `StoreQuery`, `packages/core/src/data/store.ts`)

```ts
export type StoreQuery =
  | { type: 'val';      code: string }                         // unchanged
  | { type: 'obs';      /* … unchanged … */ }
  | { type: 'schema';   /* … */ }
  | { type: 'distinct'; /* … */ }
  // ── NEW: declarative point read at an explicit coordinate + grain
  | { type:    'valAt'
      code:    string
      at?:     Partial<Record<string, DimVal>>           // Law 1: GENERIC coordinate override
      grain?:  Record<string, GrainLevel>                // Law 1: GENERIC per-dim grain (NOT {time})
      rollup?: 'sum' | 'avg' | 'min' | 'max' | 'first' | 'last'   // finer→requested aggregation
    }
```

- **`at`** overrides `ctx.dims` for this read only (no ctx cloning): the store reads `code` at `ctx.dims ⊕ at`. `at:{time:y}` reproduces `atTime(y,ctx)` exactly; `at:{geo:'GE',time:y}` is equally valid — **generic, Law 1**.
- **Default `rollup:'sum'`** ⇒ `valAt({code, at})` is **byte-identical** to today's `_val` at that coordinate (the existing implicit sum). This is the byte-identity anchor.
- **`grain`** requests an LOD. Store holds **finer** grain ⇒ rolls up via `rollup`; **coarser** ⇒ raw-fallback (returns native value, sets `meta.grainFallback`). Absent ⇒ today's behavior.

Helper beside `storeVal` (so resolvers never touch the port directly):
```ts
export function storeValAt(
  store: DataStore, code: string, at: Partial<Record<string,DimVal>>,
  ctx: SectionContext, grain?: Record<string,GrainLevel>, rollup?: StoreQuery['rollup'],
): number
```

### 3.2 Generic grain model (Law 1 — time is just one lattice)

```ts
export type GrainLevel = string                              // 'year'|'quarter'|… OR 'region'|'district'|…

export interface StoreCaps {
  // … existing fields …
  grains?: Record<string, GrainLevel[]>                      // dim → grains the store serves, FINEST-first
}
```

- `grains:{ time:['day','month','quarter','year'], geo:['district','region','country'] }` — the **same machinery** orders time and geo grains. No `'time'` literal in the rollup logic; the time lattice is one registered entry.
- `timeDimension.granularity` (already `TimeGranularity` in `data-spec.ts:98`) becomes **the time facet of this generic grain** — `resolveTimeDimension` threads it into the point-series `valAt.grain['time']` instead of dropping it (closing the "decorative" gap).

### 3.3 `point-series` resolver (the desugar target)

A single registered resolver that enumerates coordinates and fans out `valAt`:
```ts
// DataSpec (additive discriminant)
| { type:   'point-series'
    code:   string
    over:   string                                          // dim to enumerate (Law 1; e.g. 'time')
    coords?: readonly DimVal[]                              // explicit list; absent ⇒ store `distinct(over)`
    at?:    Partial<Record<string, DimVal>>                // fixed base coordinate
    grain?: Record<string, GrainLevel>
    rollup?: StoreQuery['rollup']
    pipe?:  TransformStep[] }                               // tail ops (window/derive) for growth/ratio
```
Resolver: `coords ?? distinct(over)` → for each `c`, `storeValAt(store, code, {...at,[over]:c}, ctx, grain, rollup)` → emit `{id,label:String(c),value,pct}` → run `pipe`. The 3 convenience specs lower to this:

| Convenience spec | Desugars to |
|---|---|
| `timeseries{code,years}` | `point-series{code, over:'time', coords:years≠'all'?years:undefined, grain}` |
| `growth{code,years}` | `point-series{…} + pipe:[window{fn:'diff'…} | derive(pct)]` (window `diff`/`lag` already exist — `transform/ops/window.ts`) |
| `ratio-list{pairs}` | per pair: `valAt(num)/valAt(den)` → `transform + derive(div×100)` (pairwise point reads + existing `derive`) |

Bespoke `Timeseries`/`Growth`/`RatioList` resolvers become **thin delegates** (`desugar(spec)` → generic), exactly as `PivotResolver` already does (`resolvers.ts:316`). `FF-DESUGAR-EQUIV` (`desugar.fitness.test.ts`) proves row-identity.

### 3.4 Cross-grain blend (B2)

`blend.from` (`transform/types.ts:328`) gains an optional generic grain:
```ts
| { op: 'blend'
    from: { storeKey: string; query: ObsQuery; encoding?: EncodingSpec
            grain?: Record<string, GrainLevel> }            // NEW (Law 1)
    by: string; mode?; fields?; rename? }
```
`resolveBlends` (react, `resolveNodeRows.ts:125`) requests the secondary **rolled up to the primary's grain** (issues the secondary read with `from.grain`), then `joinByField` on `by`. The cross-grain rollup happens in the **react binding layer** that already holds the manifest — **Law 3 preserved** (core never sees the second store).

### 3.5 Rollup-routing seam (DC-03) — *below* the port

A `GrainRouter` lives in **`store-impl.ts` / `apps/api`**, never in `core`:
```
valAt(code, grain=G)  →  GrainRouter
                          ├─ pre-agg registry has a materialized rollup at G?  → serve (cheap)
                          └─ else → compute from raw (rollup on the fly)
```
- **The pre-agg is a CACHE of the raw rollup, never an independent SSOT** — raw observations are authoritative (SSOT); rollups derive (Materialized-View pattern + Cache-Aside).
- **Raw-fallback correctness twin (FF-ROLLUP-RAW-TWIN):** `valAt(G via pre-agg) ≡ valAt(G via raw rollup)` for every G the store claims. This is the guard that lets the planner route freely. The cost model (which candidate is cheapest) is an *optimization*; the port contract is grain-correct regardless of route.
- Core/contract are unchanged — the router is a store-impl detail, like `CachedStore`. **Law 3 holds.**

---

## 4. Strangler-Fig phases (each independently green)

| Phase | Change | Green / byte-identical because |
|---|---|---|
| **G0** — port primitive | Add `valAt` to `StoreQuery` + `storeValAt` helper; implement in `ExternalStore`/`CachedStore` (default `rollup:'sum'`, no grain). | `valAt({code,at:{time:y}})` ≡ `storeVal(code, atTime(y,ctx))` — pure addition, no resolver touched. **FF-VALAT-COORD-IDENTICAL**. |
| **G1** — `point-series` resolver | Register the generic resolver. Nothing emits it yet. | Dead-but-tested primitive; no existing path changes. |
| **G2** — desugar `timeseries` | `desugar` lowers `timeseries`→`point-series`; `TimeseriesResolver`→thin delegate. | **FF-DESUGAR-EQUIV** (row-identical). |
| **G3** — desugar `growth`+`ratio-list` | Lower both (growth via `window{diff}`+derive; ratio via pairwise `valAt`+derive). | **FF-DESUGAR-EQUIV**. **Closes ENG-02/07/08.** |
| **G4** — grain model | Add `StoreCaps.grains` + `GrainLevel` lattice; `valAt.grain`/`rollup` actually roll up; thread `timeDimension.granularity` → `point-series` grain. | Additive — absent grain ⇒ today's behavior. **FF-GRANULARITY-ROLLS-UP** (closes the "decorative" gap). |
| **G5** — cross-grain blend | `blend.from.grain` + `resolveBlends` cross-grain rollup. | Additive optional field. **FF-BLEND-CROSS-GRAIN**. **Closes blend B2.** |
| **G6** — rollup-routing seam | `GrainRouter` + pre-agg registry in `store-impl`/`api` (below the port). Trivial router first (pre-agg-if-exists-else-raw). | Core untouched. **FF-ROLLUP-RAW-TWIN** + **FF-ROLLUP-ROUTES**. **Closes DC-03 root** (cost model deferred). |

Coordination: **G0 edits `packages/core/src/data/store.ts`**, which overlaps the **metric-delivery workstream** (contracts/api/core). Sequence G0 against that team's store edits (or land G0 first as a small additive PR). G2–G3 touch `core` only; G5 touches `react`; G6 touches `store-impl`/`api`.

---

## 5. One/two-way-door ledger

| Door | Direction | Notes |
|---|---|---|
| G0–G6 (additive query type / spec discriminant / caps field / optional blend field) | **Two-way** | `valAt` default-sum = byte-identical; grain absent = today. All revertible. |
| G2/G3 bespoke resolvers → delegates | **Two-way (low-risk)** | Behavior frozen by FF-DESUGAR-EQUIV; revert from git. |
| **`GrainLevel = string` (generic) vs a closed time-only enum** | **One-way (shape)** | Choosing the **generic** `Record<dim,GrainLevel>` over a time-privileged `granularity:'year'|…` is the Law-1 fork. Pick generic now — a closed time enum would re-privilege time and reopen this frontier. Locked by **FF-GRAIN-GENERIC**. |
| Cost-based PLANNER sophistication (multi-level lattice selection, materialized-view maintenance) | **Deferred door** | G6 ships the *seam* (router + twin) with a trivial router. Trigger: real pre-agg tables + measured-slow raw rollups. The correctness twin is the contract that makes the later planner safe to add. |

The only genuinely one-way decision is **grain = generic** (§3.2). Everything else is reversible additive.

---

## 6. Fitness functions

- **FF-VALAT-COORD-IDENTICAL** (G0 anchor): `valAt({code,at:{time:y}})` === `storeVal(code, atTime(y,ctx))` across sampled coordinates.
- **FF-DESUGAR-EQUIV** (extend `desugar.fitness.test.ts`): desugared `timeseries`/`growth`/`ratio-list` are **row-identical** (rows, order, values, nulls, color presence) to the bespoke resolvers.
- **FF-GRAIN-GENERIC** (Law 1): the grain/coordinate path uses `Record<dim,_>` only — a lint/type fitness forbidding a hardcoded `'time'` literal in `valAt`/grain logic. Time flows through `TIME_DIM`/the registered lattice, never special-cased.
- **FF-GRANULARITY-ROLLS-UP** (G4): a quarterly store + `granularity:'year'` returns the summed annual value (proves the field is no longer decorative).
- **FF-BLEND-CROSS-GRAIN** (G5): annual×quarterly blend joins at the primary grain correctly.
- **FF-ROLLUP-RAW-TWIN** (G6 correctness twin): `valAt(G via pre-agg)` ≡ `valAt(G via raw rollup)` — the SSOT guard (raw is authoritative; pre-agg derives).
- **FF-CORE-PURE** (Law 3): `valAt`+grain add **no** react/manifest import to `core`; the `GrainRouter` lives only in `store-impl`/`api`. Cross-grain second-store fetch stays in `resolveBlends` (react).

---

## 7. Effort & cards closed

**Effort: ~5–7 dev-days.** G0 1d · G1 0.5d · G2 1d · G3 1d · G4 1.5d · G5 1d · G6 1d (seam; cost-based planner deferred).

**Board cards closed:** **ENG-02 / ENG-07 / ENG-08** (desugar val-cell — G2/G3) · **blend B2** cross-grain (G5) · **timeDimension.granularity decorative** (G4) · **DC-03** rollup-routing **root/seam** (G6; full cost-based planner deferred behind the one named door). Verdict: **the highest-leverage unlock — one port primitive collapses three bespoke resolvers, makes granularity real, and opens cross-grain blend + rollup-routing on the same generic spine.** G0–G3 are immediately executable and clear the desugar backlog; G4–G6 layer the grain model on top.
