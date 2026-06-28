# DECISION — Time-"Mode" Decoupling: the orthogonal-axis law (ratification-ready)

> Status: **DECIDED — one architecture, delegated with conviction.** Not a menu.
> Author: platform-architect (Opus, senior — declarative/visual-builder + future/problem red-team lens).
> Companion + successor to `DESIGN-time-mode-decoupling.md` (the architect's exploration).
> DESIGN/SYNTHESIS ONLY — no product code changed here. Whole-vertical (core ⊥ Constructor ⊥ API).

---

## 0. The one irreversible call (ratify this sentence)

> **The platform models a data view as the PRODUCT of independent orthogonal axes —
> `dimension ⊥ selection-type ⊥ granularity` — authored once each. A flat fused-mode
> enum (`year, range, quarterly, quarterly-range, month, …`) is REFUSED at every tier
> (config, type system, authoring UI, API). `year` and `range` are two values of ONE
> axis (`selection-type`), not two views.**

That commitment is the only one-way door. Everything that realizes it — how many axes are
*wired* today, whether the grain axis ships now or behind a named door — is additive and
two-way. I adopt **Option C** and I have hardened the exploration's recommendation with a
data verdict, a surviving-literal kill, the full authoring + API vertical, and the fitness
gates. **Confidence: 0.86.** The 0.14 is owner intent on one word ("maximal"), resolved in §2.

---

## 1. C-vs-B verdict, decided against the real data

**Verdict: Option C. Decisively — and the data, not taste, decides it.**

The exploration framed C-vs-B as "is there a near-term sub-annual requirement?" That is exactly
the right question, and maximal-adoption doctrine answers it: **adopt a capability only with a
real consumer — no empty cathedral.** I went to the seed/DSD/provisioning to find the consumer.
There is none.

**The real-data finding (decisive):**

| Evidence | Source | Verdict |
|---|---|---|
| All 3 datasets carry `frequency = 'A'` (Annual) | `ops/postgres/seed/R__seed_geostat_gold.sql` (GDP_ANNUAL, ACCOUNTS_SEQUENCE, REGIONAL_GVA) | No sub-annual dataset |
| All **2 131** observations (279 + 367 + 1 485) carry a bare 4-digit-year `timePeriod` (2010–2025) | `ops/seed-data/geostat/facts/*.bundle.json` — exhaustive distinct-value scan returned ZERO non-`^[0-9]{4}$` values | No quarter, no month, anywhere in the real data |
| DSD dimension concepts = `account, geo, measure, sector, side` | `ops/seed-data/geostat/codelists.bundle.json` | **No `FREQ` dimension exists** — there is nothing to put a grain axis *on* |
| No `quarter`/`month`/`sub-annual`/`grain` requirement in roadmap or memory | project memory + roadmap grep | No near-term consumer |

**What this means for C-vs-B, stated as doctrine:**

- A **grain axis built now** = a second orthogonal `perspectiveState` key, an open grain scope-key,
  a generalized period-select — wired to **zero real data and zero requirement**. That is
  **speculative generality** (§11 code smell) wearing the costume of "maximal." It is the *empty
  grain cathedral* maximal-adoption exists to refuse. Building it would itself be an
  agnosticism-degrader: untested, unexercised generality rots (Lehman) and lies to the next
  engineer about what the platform does. **→ Option B is REFUSED, on the data.**

- The **`selection`-type generalization**, by contrast, has **two real consumers RIGHT NOW**:
  `year` = `point`, `range` = `window`. Both ship live on the geostat `accounts`/`gdp`/`regional`
  pages today (`apps/api/provisioning/geostat.provisioning.json:1400-1446`). Generalizing the
  binding is adopting a capability *with* its real consumers — the exact opposite of speculation.
  **→ build it NOW.**

The asymmetry is not a compromise; it is the doctrine applied honestly: **build the axis that has
consumers (selection), defer the axis that has none (grain) behind a named door, and remove the
agnosticism warts that cost nothing to remove (the closed grain union).** That is precisely Option C.

**Does C satisfy "I expected MORE decoupling than yesterday / maximal"?** Yes — because "maximal"
correctly read is *orthogonality*, not *axis-count*. The proven systems (SDMX FREQ⊥TIME_PERIOD,
Tableau discrete/continuous, Vega-Lite `timeUnit`, Cube `granularity`) are maximal precisely by
*refusing* to multiply views; they take the product of independent axes. Shipping an unused grain
axis is not "more decoupled," it is *more surface for copy-paste drift*. C delivers more **real**
decoupling than yesterday (§4 proves exactly what newly decouples) while refusing the one true
one-way trap. If the owner's "maximal" genuinely means "wire the grain axis on day one regardless
of data," that is the single point to flag at ratification — I would veto it as the empty cathedral
and ask for the consumer first. **`D-GRAIN` is one registration + one Record key away the instant a
quarterly dataset lands** — the seam is already open (`perspectiveState: Record`,
`listPerspectiveScopeKeys`, the multi-axis `activeDefs` walk), so deferring costs nothing and
re-architects nothing.

---

## 2. Red-team of the recommendation (multiple logics, future + problem lens)

**R1 — "Maximal-adoption ⇒ ship B."** *Refuted by the data (§1).* Maximal-adoption's own first
clause is "with a real consumer." Zero sub-annual data = zero consumer = B violates the very
doctrine invoked to justify it.

**R2 — Illegal-state representability (the `selection` fix is mandatory, not optional).**
Today the binding discriminates point-vs-window by **which optional field is set**:
`PerspectiveTimeBinding = TimeDimensionSpec & { pin?, targetKeys? }`
(`packages/core/src/config/perspective-axis.ts:77-82`). `pin` AND a `range`/`targetKeys` window
**both set** is representable-but-undefined — a classic illegal state the type permits, and one the
Constructor's two separate fields (`timeBinding.pin` + `timeBinding.targetKeys.from/to`,
`perspective-scope-schemas.ts:21-24`) let a non-engineer *author by accident*. The fix is an
explicit discriminated `selection`:
```ts
type Selection =
  | { kind: 'point';  at: TimeBound }
  | { kind: 'window'; from: TimeBound; to: TimeBound; targetKeys?: { from?: string; to?: string } }
  | { kind: 'all' }
```
This makes the illegal state **unrepresentable** (make-illegal-states-unrepresentable, §2) — at the
type level AND in the authoring UI (one `kind` dropdown, sub-fields `showWhen`-gated; PropField
already supports `enum` options + `showWhen`, `prop-schema.ts:120`). This is the load-bearing change
of the whole decision, and it has two live consumers.

**R3 — Does any `if mode === '…'` literal or closed union SURVIVE? Yes — and the decision kills both.**
The exploration claimed the selection layer is literal-clean. A whole-vertical grep found a
**surviving fused-mode literal** the exploration missed:
```ts
// packages/core/src/config/template.ts:75  (resolveCarrier)
if ('year' in tpl && 'range' in tpl)
  return activePerspective(ctx.perspectiveState) === 'year' ? tpl.year : tpl.range
```
The page-badge carrier is a **two-arm fused union `{ year, range }` keyed by a literal mode id**.
This is the *same* anti-pattern as a fused enum, hiding in the template primitive — a residual
coupling that yesterday's refactor left behind. The orthogonal law must retire it to a
perspective-keyed Record resolved generically (`Record<perspectiveId, string>` → look up
`activePerspective(...)`, no `'year'` literal, no arm count). **This is itself proof-of-more-than-
yesterday (§4): the badge carrier newly decouples from the two-mode assumption.** The closed
`TimeGranularity` union (`data-spec.ts:108`) is the other survivor — opened to a registry string by
this decision (cheap, see §1).
*(The `mode` matches in `joinByField.ts`, `shared.ts`, `condition.ts` are UNRELATED local
parameters — join-mode, tooltip-mode, a generic condition op — not the time mode. Verified. Keep.)*

**R4 — Migration risk.** Bounded and proven. The Strangler harness already exists:
`perspective-migration-equiv.fitness.test.ts` derives `sectionCtx` through the *live* pipeline for
both legacy and migrated config and asserts deep equality per page × perspective × locale. Every
phase below extends that harness, so "byte-identical where live" is a build gate, not a hope. The
generic `binding` lands *alongside* `timeBinding` (Postel alias) — no flag-day.

**R5 — Future lens: what does C foreclose?** Nothing the data wants. `D-GRAIN` opens as a
registration when a quarterly dataset arrives; `D-PERIOD-SELECT` generalizes `resolveYears` (today
`Number()`-coerces + numeric-sorts, `resolve.ts:68-83` — year-only, correctly deferred, no consumer);
`D-COMPARE` is its own axis, not a third fused mode. All additive on an open seam. C forecloses only
the fused enum — the point.

**R6 — Could C *under*-deliver and force a re-do?** Only if `selection` were modeled too narrowly.
Mitigation: `kind` is an **open** discriminated union resolved through the `DataSpec`/`ChartType`
registry pattern — a new arm (`set`, `compare`) is a registration, interpreter unchanged (OCP). No
re-do; only extension.

**Winner, defended:** **Option C**, with the `selection` discriminant and the `template.ts` literal
kill promoted into its mandatory scope. B is refused on the data; A is refused as the combinatorial
one-way door.

---

## 3. The full vertical — three tiers, no second-class citizen

### 3.1 Core / renderer (the engine)

| Change | Type / seam | Door |
|---|---|---|
| `scope.timeBinding` → generic **`binding`** scope-key | `DimBinding = { dim: string; selection: Selection; granularity?: string }` on `perspective-axis.ts`; registered via `registerPerspectiveScopeKey('binding', …)` | **build now** |
| Explicit **`selection`** discriminant (`point`/`window`/`all`) | the union in R2; kills D2 + L4 illegal state | **build now** |
| `TimeGranularity` closed union → **open registry string** | `data-spec.ts:108`; same precedent as `ChartType`; stays inert metadata (no grain axis) | **build now** (cheap wart-kill) |
| `resolveCarrier` `{year,range}` → **`Record<perspectiveId,string>`** | `template.ts:68-78`; removes the surviving `=== 'year'` literal (R3) | **build now** |
| `timeBinding` kept as **Postel alias** of `binding` | additive; retired in P-final | reversible |
| Second grain **axis** (Record's 2nd key + `grain` scope-key) | seam open: `perspectiveState: Record`, `activeDefs` multi-axis walk | **`D-GRAIN`** (deferred) |
| `year-select` → generic period/member-select | `resolve.ts:68-83` | **`D-PERIOD-SELECT`** (deferred) |
| `compare` as its own selection axis | aligns the half-built `ScopeOverride.compare` | **`D-COMPARE`** (deferred) |

The binding folds into `ctx.dims` as today via `scopeCtxByPerspective` (`perspective-axis-parser.ts:198`) — `perspective = f(state)`, no cascade. The `effectiveBounds`/`resolveTimeDimension` seam (`core/time-dimension.ts`) consumes it unchanged: `DimBinding` stays assignable to `TimeDimensionSpec` (intersection — the refine⇄widen invariant, proven by the `_scopeWidens` compile-gate).

### 3.2 Constructor / panel authoring (the make-or-break — and it is already 90% built)

**Key finding: the authoring surface needs ZERO new pane machinery.** The Constructor's perspective
scope is **registry-driven**: `perspectiveScopeSchemaSource.ts:40-50` unions every registered
scope-key's PropSchema and re-prefixes each field to `scope.<key>`. So the orthogonal axes author
themselves the moment the engine registers their schema:

- **selection-type ⊥ — a single dropdown, no code.** Register `binding`'s PropSchema with a
  `{ field: 'binding.selection.kind', type: 'enum', options: [point, window, all] }` PropField, then
  `showWhen`-gate the sub-fields: `binding.selection.at` (`showWhen: "selection.kind === 'point'"`),
  `binding.selection.from/to/targetKeys` (`showWhen: "selection.kind === 'window'"`). PropField
  already supports `enum` + `options` + `showWhen` (`prop-schema.ts:99,120`). **A non-engineer sees:
  a "Selection" dropdown — pick *Point in time*, *Time window*, or *All periods* — and only the
  relevant inputs appear.** The illegal `pin & window` state is *unauthorable* (one dropdown, not
  two independent fields). This is strictly better authoring than today's two-loose-fields shape.
- **granularity ⊥ — `enum-ref` to the grain registry**, rendered as "Grain: Year / (Quarter…)" but
  carrying metadata only until `D-GRAIN`. Pick-don't-type (Law 2).
- **dimension ⊥ — already `enum-ref: cube.dimensions`** (`perspective-scope-schemas.ts:19`).
- **Independence is visible and validated in the UI:** the three controls are *separate fields* in
  the same Inspector panel — a non-engineer reads them as three independent knobs (exactly the
  Tableau/Cube mental model), never one fused list. The `PerspectivesPane`
  (`apps/panel/src/features/perspectives/`) lists/reorders perspectives; `perspectives[0]` = default
  (one SSOT). Round-trip stays lossless (`perspectiveModel.ts` record⇄view⇄record identity).
- **Palette / capability discovery:** the selection-type options come from the registry, so the
  Constructor "sees only what's registered" — adding `set`/`compare` later makes them *appear* in
  the dropdown with no pane edit (the OCP guarantee, satisfied by construction).

### 3.3 API / provisioning (persist · serve · validate, end-to-end)

- **Persist + serve:** `binding` is pure JSON on `PerspectiveDef.scope`, carried verbatim through
  `parseFile` → `applyManifest` (`apps/api/src/provisioning/loader.ts:78-105`) into the manifest the
  renderer reads. No new transport; it is one more declarative scope-key.
- **Validate — refs-exist:** the binding's `dim` (and any `targetKeys`) must reference a real cube
  dimension. This rides the **existing config↔cube contract fitness gate**
  (`config-cube-contract.fitness.test.ts`) — the gate that already fails the BUILD when a config
  references data that doesn't exist or under-pins a dimension. It is generic over dims (Law 1), so
  `binding.dim` is covered the moment it is declared; **no new validator class needed**, only the
  field path added to the walk.
- **Validate — no illegal selection state:** because `selection` is a discriminated union, an
  invalid binding (`point` without `at`, `window` without `from`/`to`, both arms) **fails parse at
  the boundary** — fail-fast, the illegal state never reaches the renderer. Add one
  `FF-SELECTION-WELL-FORMED` gate asserting the live artifact's every `binding.selection` is a valid
  arm.
- **Migration parity:** the `perspective-migration-equiv` harness gains a third side proving the
  `timeBinding → binding` rewrite is row-identical per page × perspective × locale.

---

## 4. Proof it is MORE than yesterday (name what newly decouples)

Yesterday (`VISION-mode-as-perspective-axis` P0–P6) decoupled the **selection LAYER**: retired
privileged `ctx.timeMode` for generic `perspectiveState: Record<param,id>`, made `year`/`range` two
`PerspectiveDef`s on one axis. The owner felt that insufficient — correctly: it left the **binding +
grain + template** layers still time-shaped. This decision decouples those. Item by item:

1. **Selection-TYPE decouples from binding SHAPE.** Yesterday `year`/`range` differed by *which
   optional field was set* (`pin?` vs `range?`) — an implicit, illegal-state-permitting shape.
   Today they are explicit values of a `selection.kind` discriminant. *New: point/window/all vary as
   data on one axis; the illegal `pin&window` state becomes unrepresentable.* (D2 + L4 killed.)
2. **The binding decouples from TIME.** Yesterday `PerspectiveTimeBinding` was time-period-shaped.
   Today `DimBinding` carries a generic `selection` on any `dim`. *New: a non-time dimension can
   carry a point/window selection with zero new types.* (Law-1 privilege removed at the binding.)
3. **Granularity decouples from a closed time vocabulary.** Yesterday `TimeGranularity` was a closed
   `year|quarter|month|week|day` union — time-only, inert, a latent privilege. Today it is an open
   registry string. *New: a custom grain is a registration, not a core-type edit.* (D3 wart killed.)
4. **The page badge decouples from the two-mode assumption.** Yesterday `resolveCarrier` still
   branched on a literal `=== 'year'` over a two-arm `{year,range}` union (`template.ts:75` — a
   survivor the exploration missed). Today the carrier is a perspective-keyed Record. *New: the
   badge supports N perspectives with no literal and no arm count.* (R3 fused-literal killed.)
5. **The grain AXIS is decouplable on demand.** Yesterday there was no grain concept at all. Today
   the second orthogonal axis is a named, open door (`D-GRAIN`) on a seam already wired. *New: the
   platform can grow to quarter/month with ZERO chart-layout duplication the instant data arrives.*

That is four concrete decouplings shipped now + one made trivially reachable — strictly and
demonstrably more than the selection-layer-only refactor of yesterday.

---

## 5. Strangler phases (each green; byte-identical where live)

- **P0 — additive types + registry (no behavior change).** Add `DimBinding` + `Selection` to core;
  `registerPerspectiveScopeKey('binding', …)` with the `kind` dropdown + `showWhen` sub-fields; open
  `TimeGranularity` → registry string. `timeBinding` untouched. *Gate: existing suite green;
  `FF-ONE-VIEW-NO-MACHINERY` byte-identical.*
- **P1 — engine consumes `binding`, Postel alias.** `scopeCtxByPerspective` reads `binding` when
  present, falls back to `timeBinding`. *Gate: migration-equiv harness deep-equal on both inputs.*
- **P2 — retire the `template.ts` fused literal.** `resolveCarrier` `{year,range}` →
  `Record<perspectiveId,string>` resolved by `activePerspective`. *Gate: badge render byte-identical
  across perspectives × locales.*
- **P3 — migrate the live config.** Rewrite geostat `accounts`/`gdp`/`regional` `scope.timeBinding`
  → `scope.binding` with explicit `selection` (`year`→`point`, `range`→`window`). *Gate:
  migration-equiv third side row-identical per page × perspective × locale; config↔cube contract
  green.*
- **P-final — retire legacy.** Delete `PerspectiveTimeBinding`/`timeBinding` + the closed
  `TimeGranularity` union; name-close the deferred doors in comments. *Gate: §6 fitness all green;
  grep finds zero `timeBinding`, zero `=== 'year'`.*

---

## 6. Fitness functions (lock the law as build gates)

Adopt the exploration's six (`FF-NO-FUSED-MODE-ENUM`, `FF-BINDING-DIM-GENERIC`,
`FF-SELECTION-EXPLICIT`, `FF-GRAIN-OPEN`, `FF-ORTHOGONAL-AXES`, `FF-AUTHORED-ONCE`) and add:

- **`FF-NO-MODE-LITERAL`** — grep gate: no `=== 'year'`/`=== 'range'`/`=== 'quarter'` (or `in tpl`
  two-arm mode union) anywhere in `packages/**` (kills R3-class survivors permanently).
- **`FF-SELECTION-WELL-FORMED`** (API) — every `binding.selection` in the live artifact is a valid
  union arm; no `point`-without-`at`, no both-arms. Illegal state unrepresentable end-to-end.
- **`FF-BINDING-DIM-EXISTS`** — every `binding.dim`/`targetKeys` resolves to a real cube dimension
  (rides the config↔cube contract gate).
- **`FF-AUTHORING-REGISTRY-DRIVEN`** — the Constructor renders `selection`/`grain` purely from
  `listPerspectiveScopeKeys()`; no hand-maintained per-key form (already structurally true; lock it).

## 7. One-way vs two-way door ledger

| Decision | Door | Note |
|---|---|---|
| Orthogonal-axis model is law; fused enum refused | **ONE-WAY** | the only call the owner ratifies |
| `selection` explicit discriminant (vs shape-inferred) | one-way (within the model) | mandated — illegal-state fix |
| Build `selection` + open grain union NOW | two-way | additive |
| `timeBinding` Postel alias → retire at P-final | two-way | reversible until deletion |
| Grain AXIS now (Option B) | **REFUSED on data** | reopen via `D-GRAIN` when a quarterly dataset lands |
| `D-PERIOD-SELECT`, `D-COMPARE` | two-way | additive on open seam |

## 8. Agnosticism-degraders to REFUSE (veto list)

- **Option A / flat fused-mode list as end-state** → per-mode layout duplication → shotgun surgery.
- **Grain axis with no sub-annual data** → speculative-generality empty cathedral; data vetoes (§1).
- **`TimeGranularity` kept closed** → re-privileges time, blocks custom grains.
- **`selection` discriminated by "which field is set"** → re-admits the illegal `pin&window` state.
- **Any new `if mode === 'year'`/literal-arm carrier** → `perspective-is` + `binding` +
  perspective-keyed carriers exist so this never returns (`FF-NO-MODE-LITERAL`).
- **`year-select` numeric-only past `D-GRAIN`** → blocks non-year pickers; do `D-PERIOD-SELECT` first.

---

*Implementing paths cited inline. Decision: Option C, hardened. Ratify §0.*
