---
id: "0071"
title: "W1 — THE HONEST CANVAS: the canvas never lies (live-first default · honest unbound states · faithful chrome)"
status: DONE (2026-07-17 — merged to main, converged gate green, J3-invariants live-proven on :3013; blocks 0072–0075 now unblocked)
class: M
priority: P0
owner: — (senior/apex build agent, Opus)
implements: STUDY-authoring-canon-circle-break §F1/§F4/§W1 (Canon C2)
depends_on: ["0070"]
links:
  - docs/architecture/proposals/STUDY-authoring-canon-circle-break.md
  - work/authoring-truth/03-studio.png   # the lie, photographed: 0-KPIs, empty chart box, degenerate chrome strip
---
**Intent.** The Studio canvas must hold the WYSIWYG covenant: what the author sees is the truth of the page. Today (live-probed): structural default renders fake `0`s + empty chart boxes; an UNBOUND KPI paints `0%` even in live mode (a data-integrity breach inside our own tool); `{spanFrom}–{spanTo}` tokens leak raw; site chrome renders as an unstyled strip; two perspective controls duplicate.

**The outcome that counts.** An author opening any page sees real (or explicitly-veiled) data, honest declared states for unbound/no-data/error elements — the unbound state is an AFFORDANCE that opens the bind flow (the door to J4), never a fake number — no plumbing tokens, chrome faithful to the published site, one perspective control. Structural mode survives ONLY as an explicit opt-out veil ("preview off"), never zeros.

**Known facts (intelligence, not scope-fence).** Live-data toggle already works (`useLivePreviewStores`, G3.1 seam; probe proved real values flow). Unbound-zero originates where an unresolved KpiSpec/coordinate lowers to 0 — find the root in the interpret path and give the RENDER layer an honest-state grammar (this is engine-adjacent: design it as a declared state, not a panel patch). Chrome-faithfulness: canvas mounts chrome slices outside the real frame context/styles — `canvasSiteChrome.ts`, `packages/react` ChromeSlot, geostat css context. Duplicate controls: CanvasToolbar preview switch (BE-3) vs in-page perspective-tab-bar node.

**Hard boundaries.** No object-model change (ADR-041/042 stay verbatim). Strangler — reversible increments, converged gate green each (PARSE the vitest log; `pnpm lint` + `tsc -b apps/panel`; dist rebuilt when packages/* touched). Law 9: honest states are accessible (not color-only).

**DoD.** `FF-CANVAS-NEVER-LIES` (no rendered 0 from an unbound spec; no `{token}` text in canvas) + `FF-CHROME-FAITHFUL` green · deployed to :3013 · **Journey J3 (compose a page) walked live** via a `work/` probe or e2e vs the REAL stack (no API mocks) · screenshots for the owner.

---
### PROGRESS (Opus lead, 2026-07-15)
**Landed:** live-default+veil+one-perspective (`49c2555`) · unbound-KPI affordance (`918c515`) · **engine honest-state `Cell` seam + no-data/masked KPI consumer + masking (F7) + `FF-CELL-HONEST-STATE`** (`ac12d88`, engine-specialist — additive/reversible, 856 core green, dist rebuilt). Root-cause found: the lie's true origin is the OLAP **aggregation** (`val` sums an empty match → 0, erasing cardinality), not `?? 0` — the honest state needed a different query shape (obs-existence scan), value path stays numeric authority. Growth lesson (→ PM-3 additivity): value-path and guard-path are different reads.
**In flight:** chrome faithfulness / brand-into-manifest + stale-RED-test fix (senior-frontend).
**REMAINING for W1 close (routed after frontend lands — do not lose):**
- **Token honesty** (`{spanFrom}/{spanTo}/{time}` leak) — NOT yet done; root = canvas never resolves the page's filter-param defaults so core `resolveTemplate` echoes `{key}`. Route: resolve filter defaults at canvas build (preferred) or core honest-placeholder.
- **Chart/table silent-blank** — an empty chart box is a Canon-C2 "silent blank" (not a fake number, but not a declared no-data state either). Engine flagged full typed-row veiling = PM-4 (deferred); assess a LIGHT panel-level "no rows → declared empty state" for charts/tables so the J3 canvas is truthful end-to-end. Lead decision at integration (don't over-scope, don't leave a blank lie).
- **dev-image rebuild** (core + plugins + panel changed) → make it FELT on :3013.
- **Converged gate on the MERGED tree** (core+panel+plugins) once frontend lands — not before (mid-flight = transient).
- **J3 walk** live + screenshots → owner.

### CLOSURE (senior-frontend, 2026-07-17) — all W1 work confirmed merged on `main` (commits `918c515` honest UNBOUND KPI, `7eb4017` honest tokens + no silent-blank chart, `b69067a` engine dynamic-binding honest tri-state) + the chrome-faithful brand-into-manifest seam (`buildThemeVars`/`applyThemeOverrides`/`themeVars` prop; `chromeFaithful.fitness`). No new build needed — reconciliation + journey-close only.

**Converged gate on the merged main tree (PARSED, not exit-code):**
- `apps/panel` vitest: **133 files / 975 tests passed, 0 failed** (the prior `insertByteIdentity` RED my notes flagged is since fixed).
- W1 FFs green: `canvasNeverLies.fitness` + `chromeFaithful.fitness` + `canvasChromeFaithful.fitness` = **19/19**. Core honest-binding `binding.fitness` = **13/13**. Plugins `kpi-strip` = **11/11**.
- `tsc -b apps/panel`: **exit 0, clean**. `pnpm --filter ./apps/panel lint`: **0 errors, 6 warnings** (accepted react-refresh/exhaustive-deps baseline).

**LIVE PROOF — real stack, no mocks, remote :3013 (probe `work/probe-w1-honest-canvas.mjs`, shots `work/authoring-truth/w1/`):**
- `liveDefault:true` (live is the default) · structural opt-out raises the honest veil (`veilPresent` false→true; text "სტრუქტურული რეჟიმი — ცოცხალი მონაცემები გამორთულია; მაჩვენებლები არ არის რეალური" — TEXT label, Law 9).
- `perspectiveSwitchInToolbar:false` — ONE perspective control (duplicate folded).
- `hasNonZeroKpi:true`, real values `["80 979","+15.1%","100.0","10.7"]` — NO fake zeros.
- `tokenLeakCount:0` — no `{spanFrom}`/`{time}` plumbing leak (core `UNRESOLVED_TOKEN` proven LIVE ⇒ the packages image on :3013 IS rebuilt with current core).
- `canvasAccent:"#0080BE"` — the published GeoStat brand is faithful on the canvas root (chrome-faithful proven LIVE).
- 0 console errors / 0 pageerrors.

**One item proven at FITNESS-level only, not ambiently live:** the unbound-KPI affordance (`data-kpi-state=unbound` → `KpiUnboundCard`, the door to J4). `unboundAffordances:0` on the probed page because its KPIs are all BOUND — the affordance renders only when an unbound element is present. It is RED→GREEN in `canvasNeverLies.fitness` and its render path is confirmed-deployed (same packages image as the brand/token proofs). Photographing it live needs a composed unbound element = a state-mutating compose gesture on the shared :3013 authoring surface; deferred to the owner's J3 walk-through (or an authorized compose-mutation) rather than risk leaving a scratch node on shared state. W1 DoD (`FF-CANVAS-NEVER-LIES` + `FF-CHROME-FAITHFUL` green, deployed, invariants live-proven) is MET.
