# REVIEW — Render-Pipeline Board (items 0009–0030)

> Chief-engineer final completeness + quality review before build start. **Read-only** (flags, does not mutate the board).
> Date: 2026-07-01. Reviewer: chief-engineer (Opus). Method: read SPEC + 22 items + 3 diagnoses + screenshots + verified every load-bearing root-cause claim against live code.

---

## VERDICT: **READY-WITH-FIXES**

The plan is architecturally sound and **build-ready from item 0016 in the morning**. Every drift (#1–#5), the effects-loss, and the warm-contract are covered by an item with acceptance criteria that carry their fitness function. Element/capability/decision coverage is complete; the dependency graph has **no consumer scheduled before its capability**. The Standing DoD + the FF suite genuinely prevent "match the screenshot by faking it." Four fixes below are needed before their respective items are worked — **none blocks starting at 0016 (C1)**; the one HIGH lands at 0018 (P1), several items downstream.

**Root-cause claims verified accurate against code:**
- C1 — `base.ts:124` `fmtNum(val/1000,0)+' 000'` present exactly as diagnosed. ✅
- C2 — `spec.ts:230` `pivot`/`transform` → `[]` present; and the `query` range path (`spec.ts:218-220`) already emits an unbounded req (not `[]`), so item 0017's pivot/transform scope is correct. ✅
- C5 — `kpi.ts` has no `mean` arm; falsy-baseline `cagr` silent-zero present at **two** sites (`:163` and `:220`). ✅
- C3 — `check-laws.sh:166-170` guards `applyEffects|Effect[]|.effects` in engine+react `src`; `onEnter`/`onExit`/`applyPerspectiveEffects` are substring-safe (no collision). Recovery vocabulary is guard-clean. ✅

---

## PRIORITIZED PUNCH-LIST

### PL-1 · Item 0018 (C4) · **HIGH** · scope accuracy / SSOT
**Issue.** The item's "Files/modules touched" says *"DELETE `mapColorUtils.ts` and `buildColorScale`."* That materially under-scopes the real work. `panels/map` is a **fully-registered node**, not a lone file:
- `registry.ts:43` `export * as map from './panels/map'`
- `catalog.ts:38,61` (META + palette) · `authoring-metas.ts:45,68`
- `MapShell.tsx` imports `buildColorScale` → deleting `mapColorUtils.ts` alone **breaks the build**
- tests: `mapColorUtils.test.ts`, `MapShell.test.tsx`, `shellAxe.fitness.test.tsx` (imports the topology fn), `token-cohesion.fitness.test.ts` (imports `mapColorUtils`)
- `topologyRegistry` is consumed **only** inside `panels/map` (MapShell + shellAxe); the live `geograph` node gets its GeoJSON via a `geoUrl` prop and is **independent** — verified `apps/geostat` does NOT register topology through `panels/map`. So the node is genuinely dead-to-live-config and can be retired, but retiring it is an ≥8-site change + test cleanup.

**Risk.** Literal delete = broken build. Thorough delete = blast-radius discovered mid-build (rework). Worst: builder deletes the color engine but leaves the node registered → a *half-consolidated* map node with no fill engine = **worse SSOT than today**, silently passing "delete mapColorUtils" while the second engine's shell still ships.
**Fix.** Re-scope 0018 to **"retire the entire `panels/map` node"**: unregister (`registry.ts`/`catalog.ts`/`authoring-metas.ts`), delete `MapShell`/`MapNode`/`meta`/`mapColorUtils`/`topologyRegistry`/`index`, remove/redirect the 4 tests. Add an acceptance line: *"grep confirms zero `panels/map` importers remain and the node is absent from registry/catalog/authoring-metas."* FF-ONE-MAP-ENGINE should assert the whole namespace is gone, not just the util file.

### PL-2 · Item 0017 (C2) · **MEDIUM** · fitness-function completeness
**Issue.** Beyond `pivot`/`transform` (`:230`), three more branches return `[]`: `point-series` `'all'` (`:130`), `timeseries` `'all'` (`:154`), `growth` `'all'` (`:163`). These are *unbounded runtime-resolved reads* (analogous to the `query` `rangeMode` branch which instead emits an unbounded req at `:220`), **not** provably read-free. `FF-NO-EMPTY-REQS-FOR-READING-SPEC` as written ("no read-issuing spec returns `[]`") will either false-red on these legitimate branches, or — if naively whitelisted — mask a real cold path.
**Fix.** In 0017, state the FF's treatment of the `'all'`/unbounded case explicitly: either (a) emit an unbounded req for these three the way `query` `rangeMode` does (preferred — makes warm===read uniform), or (b) whitelist `coords/years==='all'` as an intentional runtime-unbounded read, documented, and lean on `FF-WARM-COVERS-RENDER` (live page×perspective) as the backstop. Do not leave the `[]` semantics of the three enumerated types unaddressed.

### PL-3 · Item 0018 (C4) · **MEDIUM** · misdirected primary fix
**Issue.** C4-b is framed as *"fix the join — build `colorByGeo` keyed by the geo dim code (`r.id`)."* But the code **already** keys both sides on that space: `colorByGeo` is `map.set(String(r.id), …)` (`GeoMap.tsx:123`) and lookup is `colorByGeo.get(geoCodeMap[iso])` (`:126,:155/:206`). The join is **not** mismatched. The actual flat-map cause is C4-c: the GeoJSON layer `key={selectedGeos.join(',')}` (`:202`) omits `colorByGeo`, so a late-arriving `rows` (cold warm) never re-styles. The SPEC hedges this correctly ("the concrete fix if the cause is async warm rather than a key mismatch"), but the item lists C4-b first.
**Fix.** Reorder 0018 to lead with **C4-c (add `colorByGeo` identity to the GeoJSON `key`) + the C2 warm guarantee** as the primary fix; keep C4-b only as a verification that the two key-spaces agree (they do) + the `GEO_JOIN_EMPTY` diagnostic. Prevents the builder burning time "fixing" a correct join.

### PL-4 · Item 0019 (C5) · **LOW** · two-site coverage
**Issue.** The silent-zero `cagr` guard exists at **two** call sites (`kpi.ts:163` value + `:220` trend). The item says "the `cagr` falsy-baseline branch emits `KPI_CAGR_ZERO_BASELINE`" (singular).
**Fix.** Add an acceptance line that **both** cagr sites emit the diagnostic; FF-KPI-MEAN-AGGREGATES should exercise the trend path too, not only value.

---

## AXIS FINDINGS (summary)

**1 · Completeness / no-gaps — PASS.** E1–E8 → 0022–0029; C1–C6 → 0016–0021; O-1…O-7 → 0009–0015; FF suite → 0030. Dependency order verified correct (0022 waits on C5+C3; 0027 waits on C6+O-6; 0030 waits on 0016–0021). Every diagnosis artefact maps to an item. Warm-contract covers every live read path (query/range verified). Residual: PL-2 (three `'all'` branches), PL-4 (two cagr sites).

**2 · Quality guardrail — PASS (one structural risk = PL-1).** Standing DoD attached verbatim to all 22 items. Every screenshot-faking vector is fenced by a computational FF, not an eyeball check: avg-real-growth can't be hardcoded (FF-KPI-MEAN-AGGREGATES requires the arithmetic mean ≠ 0); component charts can't fake N bars (FF-COMPONENT-DECOMP ≥2-or-diagnose); per-capita 2014 can't be cell-patched (FF-ROW-UNAMBIGUOUS + O-7 routing); flat map can't be silently ramped (GEO_JOIN_EMPTY loud-fail). No rewrite-from-scratch smuggled anywhere. The **only** quality risk is PL-1: a half-done map consolidation would leave a rival engine registered (SSOT regression) while appearing to satisfy "delete mapColorUtils."

**3 · Law/SSOT — PASS.** No privileged dims (FF-NO-MODE-LITERAL kept green); declarative config (FF-EFFECTS-DECLARATIVE bars functions; `mean`/component specs are data+intent); one formatter SSOT (0016 in `packages/core`, arrow-correct); one choropleth engine (0018 — law right, execution scope short → PL-1); Clean-arch arrow intact (compact formatter in core→consumed by plugins; `applyPerspectiveEffects` reads `PerspectiveDef` from core; Constructor pane in apps/panel); forward vocabulary confirmed guard-safe.

**4 · Risk / owner-decisions — PASS.** All 7 defaults are two-way doors and safe. **O-6 and O-7 are correctly gated so dependents can't close on a guess:** 0014/0015 both carry `needs_data_input: true` + `route_to: database-architect`; 0020/0027/0028 acceptance states "cannot fully close until O-6" and allows O-7 to close via a routed ticket + C6-d hardening. FF-COMPONENT-DECOMP and FF-ROW-UNAMBIGUOUS make a wrong guess **diagnose loudly** rather than ship. One operational note: fire the database-architect query (enumerate `measure` members under `approach:'EXP'`/`'PROD'`; gold GDP-per-capita geo=GE time=2014) at morning start, in parallel with C1 — the answer is needed by the time 0020 (P1) is reached, not before 0016.

---

## Can the owner start at 0016 (C1) in the morning?

**Yes — safely.** 0016 depends only on 0009 (O-1, default `compact`; only the `ka` glyph is owner-only and does not block the build). C1's root cause is verified accurate; its blast radius is a single seam (`formatters.ts` + `base.ts:124`). None of the four punch-list fixes touch C1 — PL-1 lands at 0018 (P1, three items downstream), PL-2 at 0017, PL-3/PL-4 at their items. Recommended morning sequence: **fire the O-6/O-7 database-architect query → build 0016 (C1) → 0017 (C2, apply PL-2) → re-scope 0018 per PL-1 before working it.**
