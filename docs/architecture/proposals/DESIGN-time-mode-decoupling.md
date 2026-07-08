# DESIGN — Maximally Decoupling the Time "Modes"

> Status: EXPLORATION / DECISION-FRAMING. No code changed. This frames a one-way,
> end-to-end-irreversible architecture call the owner must make. Read-only design doc.
> Author: architect (Opus). Companion to the shipped perspective-axis refactor
> (`VISION-mode-as-perspective-axis.v3*`, P0–P6 + Constructor pane, all merged).

---

## 0. Executive summary (read this first)

**The question.** The owner wants to MAXIMALLY DECOUPLE the time "modes" (`year` = single
period, `range` = span/dynamics) from each other — cleanly, without privileging time (Law 1),
and as a no-way-back, ideal-end-state decision (Law 7: code adapts to the plan).

**What is already true.** The mode-SELECTION layer is *already* de-privileged. The perspective-axis
refactor retired the privileged `SectionContext.timeMode: 'year'|'range'` field and replaced it
with a generic Harel orthogonal-regions container `SectionContext.perspectiveState: Record<param,id>`
(`packages/core/src/core/context.ts:51-70`). `year` and `range` are today two `PerspectiveDef`s on
one axis named `mode`, each carrying a declarative `scope.timeBinding`
(`apps/api/provisioning/geostat.provisioning.json:1400-1446`). Visibility is the generic
`perspective-is` op (`packages/core/src/config/visibility.ts:45-47,80-82`). This is clean and was
the right primitive. **The owner's question therefore is NOT "de-privilege the mode" — that is done.
It is "where does the residual coupling and residual time-privilege live, and how far do we push
decoupling without breaking the algebra or YAGNI?"**

**The residual Law-1 time-privilege debt (concentrated in the BINDING + GRAIN layer, not selection):**
- **D2** `scope.timeBinding` is *dim-generic in `dim`* but **time-period-SHAPED**: its discriminant
  between "single period" and "span" is *which optional field is set* (`pin?` XOR `range?`,
  `packages/core/src/config/perspective-axis.ts:77-82`), not an explicit selection-type. Half-privileged.
- **D3** `TimeGranularity` is a **CLOSED union** `'year'|'quarter'|'month'|'week'|'day'`
  (`packages/core/src/config/data-spec.ts:108`) — time-only, **and currently INERT** ("does not affect
  resolution in this pass", `time-dimension.ts:124-128`). A latent privilege + a closed-union
  agnosticism wart sitting on an unused door.
- **D4** `year-select` is a time-shaped ParamDef type — it coerces members to `number[]` and sorts
  numerically (`packages/core/src/data/resolve.ts:68-83`), so it cannot serve a non-year grain.
- **D5/D6** `yoy`/`cagr`/`point` KPI value-types + `effectiveBounds`/`clampYears`/`isUnsetTime`/
  `resolveTimePin` are time-domain numeric logic. Legitimately time-shaped (yoy IS a time op) but a
  time-specific code body.
- (**D1** `TIME_DIM`/`MEASURE_DIM` are named convention SSOTs, **not** branches — defensible, keep.)

**The top transferable concept (every mature system agrees).** "Time mode" fuses **three orthogonal
concerns**: (i) the **dimension** (time — already generic via `dim`), (ii) the **selection-type**
(point vs window vs all — Tableau discrete/continuous, SDMX point/range query), and (iii) the
**granularity** (year/quarter/month — Vega-Lite `timeUnit`, Cube `granularity`, SDMX `FREQ`). Proven
systems model these as **orthogonal axes and take the product** — they NEVER use a flat fused enum
(`year, range, quarter, quarterly-range, month…`), which is the combinatorial-explosion anti-pattern.
**Maximal decoupling, done right, means ORTHOGONALITY (each concern varies independently, authored
once) — NOT DUPLICATION (independent copies that re-couple through copy-paste drift = shotgun surgery).**

**The three framed options.**
- **A — Fully independent per-mode views (duplication-independence).** Each mode a standalone view,
  shares nothing but the axis. Simplest today; the **one-way door into combinatorial explosion** and
  DRY/shotgun-surgery as grains multiply. REFUSE as the end-state.
- **B — Full orthogonal de-privileging, built now.** Generalize `timeBinding` → generic `binding`
  with an explicit `selection` discriminant; split granularity into a SECOND orthogonal perspective
  axis. The ideal end-state model; cost = builds the grain axis before a real consumer (YAGNI tension).
- **C — Hybrid (RECOMMENDED): commit to B's MODEL irreversibly, build incrementally.** De-privilege
  the binding + open the grain union NOW; defer the second grain axis behind a named door `D-GRAIN`.
  Evolutionary-architecture clean, YAGNI-bounded, scales to quarter/month with zero layout duplication.

**The ONE irreversible decision the owner must make.** *Adopt the orthogonal-axis decomposition
(selection ⊥ granularity ⊥ dimension) as a platform law, and REFUSE the flat fused-mode enum.* That
commitment is the no-way-back call. Everything downstream (how many axes you wire today, whether grain
ships now or behind `D-GRAIN`) is additive and reversible. My recommendation: **Option C** — make the
commitment, realize the binding-generalization now, hold the grain axis behind a named door.

---

## 1. Precise current-state map

### 1.1 The shipped model (the substrate we build on)

| Concern | Type / SSOT | File |
|---|---|---|
| Active-mode container (orthogonal regions) | `SectionContext.perspectiveState: Record<param,id>` | `core/src/core/context.ts:51-70` |
| One axis | `PerspectiveAxis { perspectives: PerspectiveDef[] }` (`[0]` = default) | `core/src/config/perspective-axis.ts:103-105` |
| One mode | `PerspectiveDef { id, label, icon?, when?, scope?, available? }` | `contracts/src/perspective-axis.ts:58-89` |
| Per-mode effect bag (OCP) | `scope: Record<string,unknown>`, keys registered | `core/src/config/perspective-scope-registry.ts` |
| The two registered scope-keys | `timeBinding` + `metric` | `core/src/config/perspective-scope-schemas.ts` |
| The time binding | `PerspectiveTimeBinding = TimeDimensionSpec & { pin?, targetKeys? }` | `core/src/config/perspective-axis.ts:77-82` |
| Mode visibility op | `perspective-is/-in/-not` (param-aware) | `core/src/config/visibility.ts:45-47,80-82` |
| Apply active scope to ctx | `scopeCtxByPerspective` | `core/src/config/perspective-axis-parser.ts:198-262` |
| Default-resolution ownership gate | `perspectiveOwnedParamKeys` → `useFilterState` | `perspective-axis-parser.ts:147-165`; `react/src/filters/useFilterState.ts:82-105` |
| KPI per-mode visibility | `KpiSpec.when` + `kpiVisible` (render+warm SSOT) | `core/src/data/kpi.ts:68-76` |
| The toggle UI | `perspective-bar` node (reads `ctx.perspective` triad) | `plugins/nodes/perspective-bar/default/PerspectiveBarShell.tsx` |

**How `year` vs `range` is modeled today** (geostat `accounts` page,
`provisioning.json:1400-1446`): one axis `mode` with two perspectives —
- `year` → `scope.timeBinding { dim:'time', pin:{$ctx:'year'} }` (pin the user-tracked year).
- `range` → `scope.timeBinding { dim:'time', range:[{$ctx:'fromYear'},{$ctx:'toYear'}], targetKeys:{from:'fromYear',to:'toYear'} }`.

At resolve time `scopeCtxByPerspective` folds the active perspective's binding into `ctx.dims`
*before* `interpretSpec`/`interpretKpi` — `perspective = f(state)`, no mutation cascade.

### 1.2 Where the two modes still COUPLE / leak into each other

The selection layer is decoupled (orthogonal region). The coupling that REMAINS:

- **L1 — Shared filter bar.** `year` (a `year-select`) and `fromYear`/`toYear` (two `select`s) live in
  ONE sticky bar, each `visibleWhen: perspective-is(...)`-gated
  (`provisioning.json:1293-1382`). All three params co-exist in `ctx.dims` simultaneously
  (`context.dims: { time:'year', fromYear:'fromYear', toYear:'toYear' }`, `:1388-1396`). The modes
  share one parameter namespace and one context bag.
- **L2 — Shared node tree.** Year-view nodes and range-view nodes are **interleaved in one tree**, each
  `perspective-is`-gated (64 `visibleWhen` occurrences; ~half `year`, half `range`). The page IS the
  union of both views; switching hides one set and shows the other. Maximal *interleaving*, not
  maximal decoupling.
- **L3 — Shared conventional time dim.** Both modes write into the one `time` dim; `year` pins
  `time={$ctx:year}`, `range` clamps via `fromYear`/`toYear` echoed back. `time` means a point in one
  mode and a span-bound in the other — semantic double-duty on one key.
- **L4 — Shared binding SHAPE.** ONE `PerspectiveTimeBinding` type serves both, discriminated by
  *which optional field is present* (`pin?` for point, `range?` for window). `pin` AND `range` both set
  is representable-but-undefined — an illegal state the type permits (D2).
- **L5 — Redundant `mode` hidden param.** A `mode` hidden filter param (`default:'year'`,
  `provisioning.json:1331-1334`) shadows the axis param of the same name. The URL param is read by
  `perspectiveState`; the hidden filter is legacy seeding (a small SSOT smell — two declarations of
  one thing).

### 1.3 Law-1 time-privilege debt ledger

| # | Privilege | Verdict |
|---|---|---|
| D1 | `TIME_DIM='time'` / `MEASURE_DIM='measure'` named convention SSOTs | **KEEP** — SSOT constants, not branches (`context.ts:72-96`). |
| D2 | `timeBinding` is dim-generic in `dim` but time-period-SHAPED (pin XOR range, no explicit selection-type) | **FIX** — generalize to a generic `binding` with an explicit `selection` discriminant. |
| D3 | `TimeGranularity` CLOSED union, time-only, currently INERT | **FIX** — open to a registry-resolved grain string (like `ChartType`); it is the grain-axis door. |
| D4 | `year-select` coerces members to `number[]` — numeric/year-only | **DEFER** (`D-PERIOD-SELECT`) — generalize to a member/period-select when a non-year grain needs a picker. |
| D5 | `yoy`/`cagr`/`point` + `resolveTime` are time-domain ops | **KEEP** — domain-legitimate; yoy IS a time operation. Not Law-1 debt. |
| D6 | `effectiveBounds`/`clampYears`/`isUnsetTime`/`resolveTimePin` numeric time logic | **KEEP** — the canonical time-normalization seam (`time-dimension.ts`), correctly generic in `dim`. |

**Net:** residual privilege is **D2 (binding shape) + D3 (grain union)**, plus the latent D4. The
selection layer (perspectiveState, perspective-is, the axis) is clean.

---

## 2. Reference-platform survey — the proven concepts

| System | How time period-type / granularity / "mode" is modeled | Transferable lesson |
|---|---|---|
| **SDMX** | `TIME_PERIOD` is a **dimension**; `FREQ` is a **separate dimension**; a data query is a *point* or a *range* request orthogonally. | dimension ⊥ frequency ⊥ selection-type. Three concerns, three knobs — never one enum. |
| **Vega-Lite** | `timeUnit` is an orthogonal transform on a `type:temporal` field; field, type, and unit are independent properties of the encoding. | Granularity is a *property of the encoding*, not a separate chart/mode. |
| **Tableau** | The **discrete (date PART) vs continuous (date VALUE)** split — the same date field rendered as a categorical point or a continuous range is a property of the **encoding**, orthogonal to the field and to the grain. | This IS our `year`(point) vs `range`(window): **selection-type is an orthogonal axis**, not a copy of the chart. |
| **Cube.dev / Malloy** | `timeDimensions` carry a **named `granularity`**; one dimension reused across grains; `granularity:'month'` is a parameter, not a new measure. | Grain parametrizes the dimension; the dimension and its layout are authored once. |
| **OLAP** | Year→Quarter→Month is a **hierarchy** on ONE time dimension; drilling is a coordinate move (LOD), not a separate mode. | Granularity is a *level coordinate*, composable, not duplicated. |
| **Harel statecharts / XState** | **Orthogonal regions**: independent state machines composed by AND, not by a cartesian product enum. | Independent modes = orthogonal regions. **We already adopted this** (`perspectiveState: Record<param,id>`). |

**The single transferable principle.** "Time mode" is the fusion of **three orthogonal concerns** —
the **dimension** (generic already), the **selection-type** (point | window | all | set), and the
**granularity** (year | quarter | month | …). Every mature system decomposes these into orthogonal
axes and takes the **product**. The flat fused list (`year, range, quarterly, quarterly-range, …`) is
the anti-pattern they all avoid because it grows multiplicatively and forces layout duplication.

**Corollary the owner needs stated plainly:** "maximally decouple" has two readings, and only one is
the proven answer. *Duplication-independence* (two copies sharing nothing) re-couples through
copy-paste drift the moment a shared chart changes — that is **shotgun surgery**, the opposite of
decoupling. *Orthogonality* (each concern an independent axis, the page authored once, views derived
by the product) is true maximal decoupling. **The recommendation below is orthogonality.**

---

## 3. Options for an irreversible decision

### Option A — Fully independent per-mode views (duplication-independence)

- **Seam/types:** each mode = a standalone `PerspectiveDef` with its own `scope`, its own
  `visibleWhen`-gated subtree, its own sub-bar (potentially separate sub-pages). Shares only the axis
  param. Essentially today's interleave, formalized toward physical separation.
- **Law 1 / Law 2 / algebra:** satisfied (param is data; pure JSON; uses the shipped axis as-is).
- **Migration (Strangler):** minimal — partition the existing interleaved tree into per-mode fragments.
- **Door ledger:** the build steps are two-way; **but the MODELING choice (a flat list of fused
  modes) is a one-way door** into the combinatorial trap.
- **What breaks:** little immediately.
- **Scales to future modes:** **BADLY.** quarter/month × {point, window} → 6+ fused perspectives,
  each duplicating the chart layout. DRY violation, divergent-change + shotgun-surgery smells. Grain is
  never modeled as a concept.
- **Verdict:** simplest today, **refuse as the end-state** — it is the one-way door the reference
  systems exist to avoid. Flag for veto.

### Option B — Full orthogonal de-privileging (built now)

- **Seam/types:**
  - Generalize `scope.timeBinding` → a generic **`binding`** scope-key (`DimBinding`) with an explicit
    discriminated **`selection`**: `{ kind:'point', at:TimeBound } | { kind:'window', from,to,targetKeys? }
    | { kind:'all' } | { kind:'set', members }`, on any `dim`. This kills D2 (illegal `pin&range`
    becomes unrepresentable — make-illegal-states-unrepresentable).
  - Split **granularity** into a SECOND orthogonal perspective axis (`perspectiveState` Record gains a
    `grain` key → `{ mode:'point', grain:'year' }`). The multi-axis path (`D-MULTIAXIS`) is already
    reserved (`activeDefs` walks the Record; `PerspectivesByParam` is keyed by param).
  - Open `TimeGranularity` (D3) to a registry-resolved grain string (the `ChartType` pattern).
  - Generalize `year-select` → a generic period/member-select (D4).
- **Law 1 / Law 2 / algebra:** fully satisfied — binding dim-generic, selection-type generic, grain an
  open orthogonal axis; maximal use of orthogonal regions.
- **Migration (Strangler):** large — P0 generic `binding` alongside `timeBinding`; P1 grain axis +
  open grain string; P2 migrate config; P3 retire `timeBinding`/`PerspectiveTimeBinding`/closed
  `TimeGranularity`/`year-select`.
- **Door ledger:** the **MODEL is one-way** (commit to orthogonality); each build step is additive/two-way
  until the legacy is deleted.
- **What breaks:** the `timeBinding` authoring schema + Constructor pane field; the (few, inert) grain
  consumers; `year-select`.
- **Scales:** **perfectly** — quarter/month = new options on the grain axis, ZERO new layout; a new
  selection-type (compare, multi-point) = a new option on the selection axis.
- **Verdict:** the ideal end-state **model**. Cost = builds the grain axis before a proven consumer
  (YAGNI tension, Law 8).

### Option C — Hybrid: commit to B's MODEL, build incrementally (RECOMMENDED)

- **Commitment (irreversible):** adopt orthogonal decomposition (selection ⊥ grain ⊥ dim) as platform
  law; refuse the flat fused enum.
- **Build NOW:**
  - Generalize `timeBinding` → generic **`binding`** with an **explicit `selection` discriminant**
    (`point | window | all`). De-privileges the binding (D2), makes `year`/`range` explicit
    selection-types on ONE axis, authored once. Keep `timeBinding` as a Postel alias until P-final.
  - Convert `TimeGranularity` closed union → an **open grain string** (D3 wart removed) but keep it
    carried-metadata/inert — **no grain axis yet**.
- **Defer behind named doors (YAGNI):**
  - `D-GRAIN` — the SECOND orthogonal grain axis (the Record's second key + a registered `grain`
    scope-key). Wired only when a real quarter/month requirement lands. Seam already open
    (`perspectiveState` Record, `listPerspectiveScopeKeys`, `activeDefs` multi-axis walk).
  - `D-PERIOD-SELECT` — generalize `year-select` → period-select when a non-year picker is needed.
  - `D-COMPARE` — `compare` as its OWN selection axis (not a 3rd fused mode); aligns the half-built
    `ScopeOverride.compare` peer.
- **Law 1 / Law 2 / algebra:** satisfied now (generic binding); fully extensible later (grain axis = a
  registration + a Record key, interpreter unchanged — true OCP, Law 8).
- **Migration (Strangler):** P0 generic `binding` type + scope-key alongside `timeBinding` (additive);
  P1 config authors `binding` with explicit `selection`; P2 retire `timeBinding`/`PerspectiveTimeBinding`
  + close the doors with names. Scope ≈ engine binding seam + 1 config + the Constructor pane field.
- **Door ledger:** model = one-way (the commitment); every build step = additive/two-way.
- **Scales:** as B (grain door opens to quarter/month with zero layout duplication).
- **Verdict:** **RECOMMENDED** — the ideal model, YAGNI-bounded build, evolutionary-architecture clean.

### Fitness functions (lock the invariants whichever option ships)

- `FF-NO-FUSED-MODE-ENUM` — no closed union enumerates fused (selection×grain) modes anywhere.
- `FF-BINDING-DIM-GENERIC` — the binding's selection-type carries no `'time'` literal; `dim` is data.
- `FF-SELECTION-EXPLICIT` — the binding discriminates point/window/all by an explicit `kind`, never by
  "which optional field is set" (illegal states unrepresentable).
- `FF-GRAIN-OPEN` — granularity is a registry-resolved open string, not a closed union.
- `FF-ORTHOGONAL-AXES` — grain and selection live on SEPARATE `perspectiveState` keys; no axis encodes
  the product.
- `FF-AUTHORED-ONCE` — a chart's layout is authored once and shared across grains/selection-types
  (no per-mode duplicate node subtree as the END-STATE).

---

## 4. Open questions + recommendation

### Open questions for the owner
1. **Decouple = orthogonality or duplication?** The proven answer is orthogonality (§2 corollary). If
   the owner truly wants physically independent per-mode copies, flag the combinatorial/shotgun-surgery
   trap before committing — that is the one-way door I would veto.
2. **Is there a near-term quarter/month/multi-year requirement?** If YES → build the grain axis now
   (lean to B). If NO → defer behind `D-GRAIN` (C).
3. **Selection-type: explicit discriminant or shape-inferred?** Recommend **explicit** (`kind`) —
   today `pin` AND `range` both-set is a representable-but-undefined illegal state (D2/L4).
4. **Grain: separate orthogonal axis or a property of selection-type?** Recommend **separate axis** —
   it is what prevents the explosion (SDMX FREQ ⊥ TIME_PERIOD).
5. **`compare` (the half-built `ScopeOverride.compare` peer):** a third selection-type or its own
   axis? Recommend **its own axis** (`D-COMPARE`) to keep the selection axis clean.
6. **L5 redundancy:** fold the `mode` hidden filter param into the axis param (one SSOT) during P0.

### Things that would DEGRADE agnosticism — flagged for veto
- **Option A as the end-state** → per-mode layout duplication → divergent-change + shotgun surgery the
  first time a shared chart edits.
- **Keeping `TimeGranularity` a CLOSED union** once grain is real — must open to a registry string
  (the `ChartType`/`Unit` open-string precedent) or it re-privileges time and blocks custom grains.
- **`year-select` staying numeric-only** blocks every non-year grain — must generalize before `D-GRAIN`.
- **Any new code that branches on a literal mode id** (`if mode==='year'`) — the perspective-is op +
  generic binding exist precisely so this never returns.

### Recommendation (with conviction — owner decides the irreversible call)
**Adopt Option C.** Make ONE irreversible commitment now: **the orthogonal-axis decomposition
(selection-type ⊥ granularity ⊥ dimension) is platform law; the flat fused-mode enum is refused.**
Realize it by generalizing `scope.timeBinding` → a dim-generic `binding` with an explicit `selection`
discriminant, and by opening the `TimeGranularity` union — both additive Strangler steps. **Hold the
second (grain) orthogonal axis behind a named door `D-GRAIN`**, opened the moment a real
quarter/month/multi-year requirement is on the table; the seam (`perspectiveState` Record + scope-key
registry + multi-axis `activeDefs` walk) is already in place, so opening it is a registration plus a
Record key — never a re-architecture.

This is the maximal *correct* decoupling: `year` and `range` stop sharing a time-shaped binding type
(they become explicit, independent selection-types of one generic binding), grain becomes a clean
orthogonal axis the platform can grow into without duplicating a single chart, and Law 1 / Law 2 / the
shipped perspective algebra are all honored. It refuses the only true one-way trap (the fused enum)
while keeping every build step reversible.

*(All implementing file paths are cited inline in §1.1 / §1.3 / §3 — no separate index.)*
</content>
</invoke>
