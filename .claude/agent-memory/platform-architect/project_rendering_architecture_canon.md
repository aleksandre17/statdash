---
name: project-rendering-architecture-canon
description: The canonical rendering architecture — Grammar → config-compiled Reactive Query Graph → Pluggable Realizers (SPEC-rendering-architecture.md, ADR-024 slated); companion to object-model canon
metadata:
  type: project
---

`docs/architecture/proposals/SPEC-rendering-architecture.md` (sole author, 2026-07-10) is the rendering-plane SSOT — the second deep study (owner-commissioned, unconstrained lens after the deliberately-conservative object-model study). Treat as canon alongside [[project-object-model-canon]].

**Verdict (three planes):** Plane 1 grammar (NodePageConfig/DataSpec/Encoding/ChartOutput) = reference-grade, KEPT. Plane 3 realizers (renderNode 12-step, RenderTarget dom/html/pdf/api, ChartRendererRegistry — Apex already ONE strategy mechanically) = right skeleton, one hole: no static chart pixels for html/pdf/export. Plane 2 data/reactivity = the real debt: a **shadow dependency graph hand-encoded as string cache keys** (specDimKey, varsKey, recipeKey+_promiseCache in useNodeRows, _storeCache, warm.ts parallel walk) with a shipped-bug record (N34c promise-cache collision, AR-36 vars staleness) + the C2 warm≠render drift class.

**The design:** compile the config → **Reactive Query Graph** in `packages/core/src/graph/` (framework-free): sources = params/perspective/locale/theme/stream (written ONLY via CommandBus — MVU loop intact, graph is derived-state, never a 2nd store); derived = vars → scopedCtx → rows(node) (wraps resolveNodeRows body, one call site) → ChartOutput. `extractDeps` = SSOT dependency scanner (total because Law 2 forbids functions — every dep is a named $ctx/$ref/template ref). Semantics: pull-lazy + push-invalidate, topological/glitch-free, async via promise-holding nodes + React use(); adapter = useGraphRows (useSyncExternalStore). Lineage: **Vega's spec→dataflow compilation at Grafana-Scenes' dashboard scale with Solid-signals semantics** — possible only because our dashboard grammar is fully declarative (the nobody-else-has-this edge). Subsumes: useNodeRows caches, warm pass (warm = cold graph eval ⇒ warm===render by construction), useNodeStream/polling, cross-filter READ side, Constructor live-preview incremental recompile.

**Rejected (ADR-024):** ALT-A Vega/VL as runtime (scope mismatch, dual state stores vs URL-param SSOT/Law 9; VL allowed later as a mere chart strategy) · ALT-B more caches (symptom) · ALT-C reactive lib (RxJS/preact-signals/TanStack — wrong layer/grain; in-house small engine, core can't take view deps) · ALT-D own scene graph dropping React (NIH; React = retained a11y realizer, kept).

**Migration V0–V6:** V0 ADR+FFs+baseline measurements (honesty gate: today's perf is fine — case rests on bug-class + Constructor/ApiStore era; fallback = V1+V5 only) · V1 extractDeps SSOT (standalone value) · V2 graph engine shadow-mode (FF-GRAPH-PARITY) · **V3 render-path switch, contract = THE one-way door (D-RRA-2)** · V4 subsume warm/stream/poll · V5 **static ChartEmitter** ChartOutput→SVG (Observable Plot model; independent, rec build now — unlocks AR-48 embed/export + AR-28 SSG/no-JS chart pixels) · V6 optional strategies YAGNI.

**Relations:** object-model R2 kpi-card promotion ↔ graph mutually reinforcing (per-card graph nodes); Placement-Law/SL-series unaffected; AR-28 CSR/SSG confirmed + strengthened by V5; AR-42 WRITE adapter proceeds unchanged (graph = its READ completion); C2 warm-contract subsumed at V4.

**How to apply:** any new binding surface (marks, metrics, streaming) must register in extractDeps, never a new hand-tuned cache key; refuse module-level row/promise caches outside core/graph (FF-ONE-DERIVATION-PATH post-V3); at Leader's Scans check V-phase progress + whether owner gated D-RRA-1/2/3.
