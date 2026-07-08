# AUDIT BRIEF — styles / responsive / panel-sizing (for the next Opus session)
> Owner plan: ship demo on the current verified state → continue on Sonnet → when Opus budget resets,
> run a SENIOR AUDIT of the whole styles/responsive/sizing system from this brief. Self-contained.

## 1. CURRENT STATE (ground truth, 2026-06-29)
- **LIVE = git HEAD = `cad9f77`** (server and `main`-branch in sync). Demo shipped on this.
- **Verified-good (real-browser screenshots):** paired sections SYMMETRIC (gdp donut/bar equal height),
  KPIs equal, charts fill, **regional map renders**, full green gate (build:engine/typecheck/`tsc -b apps/panel`/
  lint/check-laws/vitest 2026).
- Working tree CLEAN. Nothing half-built committed.

## 2. WHAT SHIPPED vs WHAT WAS ATTEMPTED+REVERTED
**Shipped (live, good):**
- `84d8a93` — cqi-bounded panel height: `--size-panel-height: clamp(380px, 64cqi, 560px)` on the BODY as a
  flex-basis; chart-fill chain; `tokens.css` + `panel-layout.css` + `panel-sizing.fitness.test.ts`.
- `c27c235` — **layout node owns equal-height**: `.layout-columns`/`.layout-grid` `align-items: stretch`
  (`layout.css`). THIS is what made paired sections symmetric. Authorable `align` capability present in CSS
  (`[data-align]`) but the prop is NOT wired (kept floor ColumnsNode/GridNode to avoid schema drift).

**Attempted then REVERTED (`83d117a` → revert `cad9f77`):** the canonical source-level cleanup —
`panel.ts` `applyPanelStyles` = placement/width only (stop emitting height on the `.panel-col` wrapper) +
strip the dead `[data-aspect]` aspect-ratio `--ar-*` cascade from `node-styles.css` + architect's
`panel-layout.css`/`chart.css`. Full green-gate PASSED (vitest 2026) BUT real-browser caught 2 regressions:
**(a) regional map COLLAPSED** (empty card), **(b) donut legend spilled** below the chart. Reverted.

## 3. THE KNOWN BLOCKER (root of the revert)
A `.panel` (geograph **map**, Leaflet) is NOT a `.section`, so its height token lands on the OUTER
`.panel-col` wrapper, and the map body gets its definite height THROUGH the wrapper's `data-height`
(`panel-layout.css`: `.panel-col[data-height] > .panel > .panel__body { flex: 1 1 band }`). The clean
"height lives on the body, not the wrapper" model (architect's `panel.ts`) removes the wrapper's data-height
→ the map loses its definite height → Leaflet (absolutely-positioned) collapses. **Charts (ApexCharts) and
the map get their height by DIFFERENT paths; a body-only model must give the map a real definite height too.**

## 4. KNOWN INTERNAL-CLEANLINESS DEBT (not visual; safe but not canonical)
- **Counter-rule:** `.panel-col[data-height] { height: auto }` exists ONLY to neutralise a band wrongly emitted
  on the wrapper (height is double-emitted: wrapper + body). Works (zero visual effect), but the canonical
  fix is to stop the wrapper emission at the source — blocked by §3.
- **Dead `--ar-*` DOM vars:** the CSS `[data-aspect]` is a clean band alias (no aspect-ratio applied), but the
  RESOLVER (`applyNodeStyles`) still EMITS inert `--ar-default`/`--ar-sm` inline vars (owner found these in the
  DOM). Dead but harmless; cleaned only by retiring the data-aspect emission for data panels.
- **Provisioning residue:** `geostat.provisioning.json` still authors `"height":"16:9"`/`aspectRatio` (legacy
  alias → band). Strangler target: migrate to a `size` token (DESIGN-panel-sizing-cqi.md).
- **Chart JS font brand-leak:** ApexCharts SVG hardcodes `BPG Arial` (Law 1, JS axis) — chart-typography wave.

## 5. PRESERVED FOR THE AUDIT
- **Architect's full canonical attempt:** git worktree `.claude/worktrees/agent-aa65bc89b4210f841`
  (branch `worktree-agent-aa65bc89b4210f841`) — the complete body-height + layout-node + resolver-cleanup,
  WITH the `--ar-*` residue and the map-collapse bug. Read it for the design, not as shippable.
- Design docs: `DESIGN-panel-sizing-cqi.md`, `DESIGN-css-responsive-standard.md`, `DESIGN-styles-architecture.md`.

## 6. AUDIT CHARGE (for Opus)
Senior audit of the WHOLE styles/responsive/sizing system — is the model canonical + best-platform, or is the
counter-rule/double-emission a smell to resolve at root? Specifically:
1. The right canonical sizing model: body-only height + how a `.panel` MAP gets a definite height in that model
   (solve §3) — so the counter-rule + dead `--ar-*` emission can be retired with NO map/chart regression.
2. Whether `align-items: stretch` equal-height + cqi band is the correct best-platform concept, or a deeper
   layout-node model is warranted (and wire the authorable `align` prop properly — schema artifact + i18n labels).
3. The chart-fill-in-stretched-card behaviour (short chart leaves white space) — is filling correct, or should
   the band cap tighter? Reconcile with the donut-legend-spill seen in `83d117a`.
4. Process law reaffirmed: ONE change → green gate → REAL-BROWSER verify every page×layout (esp. regional map +
   gdp paired) → keep or revert. Green gate ≠ visually correct (proven twice this session).
