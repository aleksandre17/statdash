---
name: systemic-findings
description: Standing, still-open SYSTEMIC findings distilled from the retired per-epic review snapshots (v13-v21, acl-parity, overnight-parity, statebfix, finish-line, ship-readiness, close-board, master-board, live-product, perspective-axis, db-schema-gaps, adr0023). Point-in-time (2026-06 → 07-03) — VERIFY each against current code before acting; the shipped fixes are in git, only the still-open patterns live here.
metadata:
  type: project
---

Cross-cutting patterns that recur across reviews and were NOT yet closed when their snapshot was taken. Each is a class, not a one-off. **Always re-grep before acting — these are 2026-06/07 observations and some may be fixed since.** Board/verdict prose lives in `platform/work/*` + git; this keeps only the durable systemic roots.

**Discipline lead-in:** the platform is more mature than a surface read implies — grep before claiming a capability is missing (async data resolution, JWT+roles auth, provenance/FieldConfig/DataLinks, export registry, Constructor spine were all repeatedly mis-claimed absent). And never trust a green gate without confirming the gate actually *reached its assertion* — see [[kit-false-green-classes]] for the false-green failure mode.

## 1. Async cache-key not truly node-unique (latent cross-panel collision)
`useNodeRows` async `_promiseCache` key = recipeKey ⊕ depKey but **drops the STORE axis** — two same-recipe/same-fetch nodes routed to DIFFERENT stores (M1 metric→dataSource routing is shipped) collide → State-B round-2 on a multi-store async page. Required completion: fold `ctx.pageStoreKey` (renderNode overrides per-subtree via `effectiveStoreKey`) into the async key, as the sync memo already does. Same collision class in `useKpiRows` — `kpiDepKey` includes specs ONLY on the static (reqs.length===0) branch; the hot reqs path is code×dims with NO recipe. Guard: FF-KPIROWS-CACHE-NODE-UNIQUE. Latent (single-store pages today), lands live on the first multi-store async page.

## 2. Conditional-GET / 304 — RESOLVED (re-verified 2026-07-15, was dead code)
Prior state: the warm-read early-return preceded the If-None-Match guard → 304 branch inert (green-by-matching-dead-code). **NOW FIXED:** `packages/core/src/data/store-api.ts:155–197` splits warm-fresh (returns early, line 155) from STALE-but-present (falls through, sends `If-None-Match` only when `cached` is held, line 166; 304 branch reachable at 181). The comment explicitly documents the fix ("sent ONLY when we already HOLD the slice"). Close this finding; kept as a re-verification example (a documented dead-code claim can silently close on refactor — always re-read before citing).

## 3. i18n contract not enforced at the type boundary (Georgian leaks into EN)
Several user-facing text fields are typed bare `string`, not `LocaleString` — chart series `name` (`packages/charts/src/types.ts`), page-header badge `{year,range}` template (`PageHeaderNode.ts`), KPI trend `value`. `geostat.provisioning.json` authored them Georgian-only → Georgian leaks into the EN product. Fix at the contract (promote to LocaleString) + a fitness guard (no non-ASCII in a bare-string user-facing field). Related weakness: `resolveRowLocales` distinguishes LocaleString carriers by a **denylist** (`NON_LOCALE_ROW_FIELDS={provenance,seriesFormat}`) not a positive tag — the next structured non-LocaleString DataRow field (or an object-valued classifier `metadata` lifted via `$cl`) is silently flattened unless added to the set (Protected-Variations weakness). Backend twin lives in [[project-db-i18n-divergence]] (silver validator hardcodes ka|en vs the gold `config.locale` contract).

## 4. Query-layer time granularity hardcode
`apps/api/src/routes/stats/observations.ts` maps range from/to to `${from}-01-01` / `${to}-12-31` — an ANNUAL assumption. A quarterly/monthly dataset's range filter is wrong at the boundary even though the cube stores sub-annual correctly. Related decorative gap: granularity/grain is still ornamental at `time-dimension.ts` (G0-G3 built; G4/G5/G6 unbuilt).

## 5. Unit/measure metadata model + version-bump gaps
`stats.observation` has no first-class/validated UNIT_MEASURE / UNIT_MULT / DECIMALS / BASE_PERIOD — they live only in the unvalidated open `obs_attribute` bag, so a chart can't reliably know "millions GEL" vs "index". Highest-value SDMX/Eurostat-grade addition (partially in motion via V16 units — verify vs [[project-color-token-jsaxis]] sibling work). Also `dataset_version` bump is app-driven, not trigger-driven: a direct SQL write to `stats.observation` does NOT bump the version, so the ETag can go stale if ETL bypasses `bump_dataset_version`.

## 6. Prod-hardening doors (documented, still open)
- `EMBED_SECRET` has dev default `'dev-secret-change-in-prod'` and does NOT fail-fast in prod → embed tokens forgeable if unset. Make it required when NODE_ENV=production.
- `ENFORCE_CONFIG_VALIDATION=false` (WARN floor, `pages.ts`) — one-boolean flip to REJECT after the stored-corpus audit (`scripts/audit-config-validity.ts`) is green.
- `PUBLISH_ROLES=['admin']` — no dedicated 'publisher' role; additive expand when publish≠admin is needed.

## 7. Palette-visible stubs + unbuilt Stranglers (cathedral-with-a-door / Law-6 dup)
`panels/map` is palette-visible but `MapShell` always renders a placeholder (RX-16 two-map-node-types Law-6 dup) — interim fix: mark hidden in `meta.ts` until real. Time-mode → perspective-axis Strangler is RATIFIED (Option C) but UNBUILT — the fused-mode literal at `template.ts:74-75` survives. When that work resumes, the pre-code review flagged: contract-requiredness (`ContextMapping.timeMode` is REQUIRED at `filter-params.ts` — relax to optional in P1 before configs can drop it, expand-contract ordering) and a wiring gap (`evalVisibility` reads mode from a positional `mode?` param sourced from `ctx.mode.current`, NOT a ctx slot — the new `perspectiveState` slot must be threaded to that callsite). ADR-005 is the decision SSOT.

## 8. Adoption debt — the meta-fitness antidote
Recurring pattern: capabilities built + fitness-locked but with ZERO prod consumers ("cathedrals without congregations" — semantic layer / MetricDef, multistore, several ENG items). Antidote worth encoding as ONE meta-fitness: **no registered/authorable capability without a runtime consumer OR an explicit, shrinking deferred-list entry.** Distinguish conscious deferral (fine) from silent orphan (debt).

## 9. WCAG / degraded-state floor that green CI masks
- RSP-R1 sr-only phantom scroll (WCAG fail on every dashboard).
- Perspective-bar keyboard nav broken; no `prefers-reduced-motion`.
- Degraded states skip the design system: error boundary renders raw RFC-9457 problem-details JSON; fail-soft empty state is English-only on /ka/; not-found is chrome-less. One "degraded-state kit" fixes all.

## 10. Live ≠ HEAD verification discipline
The deployed CSS/JS bundle can lag HEAD (e.g. a dark-mode token missing live while its fitness fn passed at HEAD). Always audit the DEPLOYED bundle (`curl …/assets/<hash>.css | grep <token>`) and re-verify after a redeploy before trusting any verdict. Sweep hazard: a burst of rapid page loads trips the API rate limiter (429, retry-after) and masquerades as "Page not found" / "Failed to load" — throttle multi-load sweeps, re-verify suspects with clean single loads.

## 11. AR-0023 SCD-2 residuals (cluster CLOSED, two cosmetic/latent nits)
The classifier hierarchy id-chain→code-chain move (ADR-0023, V23 expand / V24 contract) closed the version-vs-identity defect BY CONSTRUCTION. Two residuals: (a) the V24 line-145 trigger-ordering COMMENT is factually wrong — it claims `trg_classifier_no_cycle` sorts before `trg_classifier_code_path`, but Postgres fires same-timing BEFORE-row triggers alphabetically and `code_path` < `no_cycle` so code_path fires FIRST (behaviorally benign, both abort the txn); (b) `code_to_ltree_label` sanitiser is many-to-one — benign for ancestry traversal, NOT collision-free, so a hex/base32 encoding would be strictly stronger if identity-grade `code_path` is ever needed.
