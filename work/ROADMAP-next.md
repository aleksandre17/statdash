# ROADMAP-next — evidence-based "what's next" menu

> Overnight reconstruction, 2026-06-27. Read-only planning; no code changed.
> Method: every candidate cross-checked against ACTUAL CODE (Grep/Read), not memory.
> Boards/ADRs marked "proposed" were resolved against the repo — most are SHIPPED.

---

## 1. Where we are (5 lines)

1. **Today's goal is DONE**: the mode → generic `perspective` axis refactor is fully landed (HEAD `f316001` + `e01bcbd`, P0→P6 + Constructor Perspectives pane, branch `feat/tenant-agnostic-platform`, pushed).
2. **The whole planned roadmap is shipped**: data-model R1–R6, multi-store M0–M2, source spectrum S0–S2 (`static`/`href`/`stats` kinds + blend), Constructor coverage+UX V0–V7, theming/variant/nav spines, platform-structure phases 0–6, de-tenanting Phase A/B/C — all green, fitness-locked, real-Postgres validated (~1669 tests).
3. **SDMX domain is deep**: V1→V34 clean (release-vintage, content-constraint, concept/category scheme, dataset-lifecycle FSM, ref-metadata V31, code-path SCD-2) + a proven canonical Excel→SDMX ingestion pipeline serving real data on the live demo.
4. **What's genuinely left is small or gated**: one canon-closing dead-code deletion (architect-flagged), one additive adoption refactor, and a set of items that need a *user direction* (content) or an *environment* (server/CI) or a *trigger* (gold-plating) — not blind building.
5. **Net**: the platform is at planned best-in-class. Tonight's safe value is *hardening canon*, not adding scope. The big forks are the user's to call in the morning.

---

## 2. Ranked menu (highest value × lowest regret first)

### ① Delete the dead `ScopeOverride.compare` surface — close the Law-7 liability the architect flagged
- **Goal**: remove the half-built, write-only N37 "compare" mechanism the perspective refactor left behind.
- **Status now**: LIVE-but-DEAD. `scopeOverride.ts`, `mergeScope.ts`, `resolveCompareRows` (`packages/react/src/engine/renderNode.ts`), `RenderContext.compareRows/compareLabel` (`core/src/core/context.ts`) all exist; **zero JSON config sets `"scope":`**, **no shell reads `ctx.compareRows`** (grep-confirmed in `engine-specialist/project_perspective_axis_residuals.md`), no test exercises it. P6 ("retire ALL System A") cleaned `timeMode` but missed this peer.
- **Readiness**: FULLY DESIGNED — the residual doc spells the exact deletion list (RESIDUAL 1). No design phase needed.
- **Value**: closes a Law-7 violation ("half-built mechanism is a liability, not an asset" — the architect's own words) on tonight's just-finished refactor; shrinks the engine surface; makes "no privileged/dead axis" true by construction.
- **Effort**: S · **Risk**: two-way door (pure deletion of grep-provably-dead code; a `D-COMPARE` door re-derives it from a registered scope-key if ever needed).
- **Dependencies**: none (perspective refactor is the prerequisite — done).
- **Lowest-regret?** YES. Additive-by-subtraction, designed, two-way. **Strongest safe-tonight item.**

### ② Adopt the semantic layer "in anger" (R1 adoption) — register MetricDefs, flow provenance/unit through bindings
- **Goal**: make the wired-but-orphaned middle tier load-bearing — register real `MetricDef`s and let bindings reference metrics (carrying unit/methodology/dataSource) instead of raw codes.
- **Status now**: mechanism SHIPPED (`resolveMeasureRef`, `metric-store.ts` `specDataSource`, `MetricDef.dataSource`), but **zero MetricDefs registered in production** — `registerMetric()` is called only in test files; the live config has **97 raw `measure` code refs** (`apps/api/provisioning/geostat.provisioning.json`). The seam is Postel (raw code today, metric-id when registered) → adoption is purely additive, byte-identical.
- **Readiness**: DESIGNED (R1 + `RESEARCH-data-binding-architecture.md` §6b names it "highest ROI, no new architecture").
- **Value**: architecturally the field's "where multi-store power lives" — BUT honest caveat from the residual investigation: the geostat year↔range difference is the KPI `value.type` (`point`↔`cagr`), **not** the measure (same code both perspectives), so for *these* pages a MetricDef can't carry the real difference; the win here is provenance/unit/methodology flow + proving the tier, not a structural unlock. Medium value, not the headline value the general framing implied.
- **Effort**: M · **Risk**: two-way door (Postel byte-identical; `FF-METRIC-FLOWS` guards it).
- **Dependencies**: none.
- **Lowest-regret?** YES (additive, designed) — but flag the modest real impact so the user weighs it against ①.

### ③ Exercise multi-store routing + `blend` with a real two-store page
- **Goal**: prove the multi-store/blend capability end-to-end by authoring one page that binds two `storeKey`s (gdp + regional) and one chart that blends them on `time`.
- **Status now**: routing (`resolveStore`/`resolveStoreByKey`) + `blend`→`joinByField` SHIPPED and tested; **no live page uses two stores** — the capability is unexercised in content.
- **Readiness**: capability designed; the *content* (which page, what comparison) is undecided.
- **Value**: proves `FF-MULTISTORE-ROUTES`/`FF-BLEND-ROUTES-SECOND-STORE` against real content; demonstrates a flagship capability.
- **Effort**: S–M · **Risk**: two-way door.
- **Dependencies**: none technical.
- **Lowest-regret?** PARTIAL — authoring a *real* page is a tenant-content decision (what story to tell). Better as a **user-direction** item than a blind-build; a throwaway fixture demo is safe but lower value.

### ④ Deploy + CI infra follow-ups (remote node-vite tar-scope; CI Postgres for DB-gated gates)
- **Goal**: unblock remote panel/geostat container deploy and run the DB-gated parity gates in CI.
- **Status now**: precisely diagnosed, not built. `deploy.ps1 remote` tars the module dir, not the workspace → remote build can't see `packages/*` siblings (kit driver-level; local dist/sync work). `P1-3` + bootstrap-parity gates `skip.unless DATABASE_URL` — need a CI Postgres job.
- **Readiness**: DESIGNED (OVERNIGHT-2 + kit ops memory name the exact fix: mirror node-api's workspace rsync).
- **Value**: operational (DORA — deploy frequency + a real-DB CI gate); no product surface.
- **Effort**: M · **Risk**: two-way, but **needs the user's server/secrets/CI environment** (`docker network`, `.env`, runner config).
- **Lowest-regret?** NO for tonight — environment-gated (user-owned). Ready the moment the user engages the server.

### ⑤ SDMX domain-completeness residuals (quality indicators · SDMX-REST serve surface · SIMS/ESMS)
- **Goal**: the agency-level completeness items beyond what's shipped.
- **Status now**: ref-metadata FOUNDATION shipped (V31, `contracts/reference-metadata.ts`); **quality indicators + an SDMX-REST *serve* API surface are genuinely unbuilt** (present only in `docs/`, no route). A `Serializer` port is reserved (`?format=`, json-only now).
- **Readiness**: needs a design phase AND a real trigger; OVERNIGHT-2/4 explicitly tag these "per-tenant gold-plating, wrong-if-built-blind."
- **Value**: expected at agency maturity, but **no current consumer**.
- **Effort**: L · **Risk**: one-way-ish (a published serve contract).
- **Lowest-regret?** NO — trigger/design-gated. Do not build blind.

### ⑥ Planner-class doors (D3-PLANNER · metric-level blended view · full auth/ApiResponse envelope)
- **Goal**: symmetric N-store query planner, server-side join, pushdown, full remote-auth framework.
- **Status now**: bridged by seams/escapes; explicitly deferred behind named doors.
- **Readiness**: NOT designed for build (each is a one-way door, trigger-gated: 3+ stores / too-big-to-client-join / a real authenticated remote source).
- **Value**: speculative until a consumer exists.
- **Effort**: L · **Risk**: one-way door.
- **Lowest-regret?** NO — the canon explicitly says do-not-build-blind. Listed only for completeness.

### ⑦ Small hygiene follow-ups (low value, mostly safe)
- `verify-parity.ts` is dead-as-a-script (kept as a comparator import — Chesterton's Fence, remove with care); `api-actions.ts` save-guard derives from `defaultLocale` not `activeLocales` (deferred until a non-ka/en locale ships); G3.2 canvas live-preview DataSpec debounce (deferred Constructor perf); `migrate_layout_names.py` hardcodes legacy dir names (make manifest-driven). Each S, two-way, none guesses direction — but individually low value.

---

## 3. SAFE TO START TONIGHT
> Additive (or pure dead-code subtraction) · already-designed · two-way door · advances canon · **no direction guess**.

- **① Delete the dead `ScopeOverride.compare` surface.** Grep-provably dead, exact deletion list already decided in `engine-specialist/project_perspective_axis_residuals.md`, closes a Law-7 liability on tonight's refactor. Add a fitness/grep guard so it can't return. **← do this first.**
- **② Semantic-layer adoption (register MetricDefs + Postel-migrate bindings).** Byte-identical, `FF-METRIC-FLOWS`-guarded, designed in the data-binding research. Start additively (register metrics, flow unit/methodology/provenance) — but carry the honest caveat that for the geostat pages the year/range difference is `value.type`, not the measure, so impact is provenance/unit flow, not a structural unlock.
- **(optional) ⑦ hygiene**: removing `verify-parity.ts` as a script and similar — safe but low value; only if ① and ② are exhausted.

**Explicitly NOT tonight** (need a user call or environment): ③ real two-store page (content decision), ④ deploy/CI (server/secrets), ⑤ SDMX completeness (trigger+design), ⑥ planner doors (one-way, do-not-build-blind).

---

## 4. Top recommendation
The platform has reached its planned best-in-class state; there is no large remaining build that is both designed and direction-free. The right overnight move is a **tight canon-hardening pass, not new scope**:

1. **Start with ① — delete the dead compare surface** (closes the one Law-7 liability the architect flagged on the just-finished perspective refactor; pure two-way subtraction).
2. **Then optionally ② — begin semantic-layer adoption additively** (byte-identical, fitness-guarded), with the honest note that its real geostat impact is provenance/unit flow rather than a structural unlock.

Everything higher-scope — the multi-store content page (③), deploy/CI (④), SDMX completeness (⑤), planner doors (⑥) — is a **morning decision**: each needs either a content/direction call or an environment the user owns. Surface those as the decision menu; do not pick among them overnight.
