---
id: "0083"
title: "CANVAS CTX BOOT DIVERGENCE — no-param studio entry renders a lying coordinate (persistent KPI no-data)"
status: ACTIVE (2026-07-18, lead-diagnosed to a deterministic reproducer; debugger tracing the root)
class: M
priority: P0
owner: lead (diagnosis) → debugger (root trace + fix)
implements: Canon C2 (the canvas never lies) + Law 9 (URL = state SSOT) — violated on one boot path
links:
  - platform/e2e/probes/probe-0081-replica.mjs      # REPRODUCES: no-param entry → persistent no-data
  - platform/e2e/probes/probe-bind-transient.mjs     # HEALTHY: ?page=regional entry → values at 1.5s AND 6s
  - platform/apps/panel/src/studio/StudioShell.tsx   # Effect A/B page-param binding (looks sound; ctx init is the suspect)
---
**The deterministic boundary (lead, instrumented, 2026-07-18 00:0x):**
- `goto /` → login → `goto /studio/insert` (NO param; app appends `?page=regional` itself via Effect B) → **ALL canvas KPI cards render "მონაცემი არ არის" PERSISTENTLY** (1.5s AND 6.5s — not transient).
- `goto /studio/insert?page=regional` (param at boot) → all four KPIs render real values (80 979 · +15.1% · 100.0 · 10.7), zero console errors, at both timings.
- Same final URL, same active page, same api, same data both ways. Obs WIRES on the healthy path are byte-identical to the portal's. The divergence is INTERNAL ctx/default initialization order, boot-path-dependent.
- Bind gesture is IRRELEVANT (earlier suspicion falsified — bind works and leaves KPIs healthy on the param path).

**Eliminated by instrumentation:** metric registry (palette via describeApp = populated; governed ref lowers to raw code on the wire live) · storeGenId fold (present in useKpiRows) · filter.measure corruption (fixed b544819, reprovisioned) · stale panel src (synced, md5-verified) · transient loading window (persists at 6.5s).

**Suspect class (memory: debugger/async-store traps #10):** section-ctx filter DEFAULTS (e.g. year) resolving through an async options source during the no-param boot — loading-vs-empty hole → a dim resolves ''/0 → point-read coordinate wrong → honest no-data forever (no re-resolution). The no-param path mounts the canvas BEFORE Effect B settles the URL; the param path mounts with the page known. Find where canvas section ctx defaults resolve relative to page activation, and make BOTH boot paths flow through ONE initialization sequence (root fix — never a re-render kick).

**DoD:** replica probe prints VALUES on the no-param path · both probes green at 1.5s · panel gate (vitest parsed + lint + tsc -b apps/panel) · a fitness test pinning one-init-path (both entries produce identical resolved ctx) · synced to dev + live-verified.
