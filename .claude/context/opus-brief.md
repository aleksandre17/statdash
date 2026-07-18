# Opus Brief — durable resume state

> **⛔ ROOT LAWS FIRST.** Containment = ADR-041 (one Part grammar · one port · residence-at-field). Authoring = ADR-042 (Triprojection: Select/Inspect/Manipulate over the one Part model). Product canon = **CLAUDE.md Law 11** (Data first · canvas never lies · projection with a plane · a journey is the unit of done). FF ratchets red the build on violations. A new kind is a DECLARATION, never a bridge.

## Current State (2026-07-18, end of the two-day pipeline marathon — continue MID-STRIDE)

**Branch: `main` ONLY (all others merged/deleted 07-17, remote too). Everything below COMMITTED+PUSHED. Full suite 3923/0 · panel 1110+/0 · `tsc -b` clean. Dev tier live: :3013 studio / :3012 portal (admin/dev_admin_pw_123); panel src synced, core tar-synced (incl. the NeCtxRef fix), api rebuilt+reprovisioned (regional v6 · gdp v7).**

### THE ACTIVE PROGRAM — card `0082` (AR-54 · ADR-046 ACCEPTED, owner-blessed «ნდობას გიცხადებ, გააკეთე»)
Query-as-visible-pipeline + the raw-data home. **LANDED (all live-proven on :3013):**
- **W-P0…W-P5c + ADR-047 Wave A:** FF gates+baseline · live per-step grid · three-pane workbench (focus-view) · 7-verb palette + governed cells · `pipeline`+`source` engine · LIVE desugar switch (query/transform/pivot → the ONE spine, byte-identical; ratio-list/timeseries/growth = honest value-cell exceptions awaiting a 4th source variant, architect-owned) · browse lowering (grain-∅ governed head = observation browse, ADR-046 Add.2) · metric-natural coordinates (ADR-047 — the −100 lie killed; real growth series live: 2011:17.8 … 2020:0.13 … 2023:11.0, first period honest «—»).
- **P-OFFER (owner doctrine «ყველაფერი შეთავაზებული»):** offer-driven Filter/Sort/Lookup (live 200→26) · field-ROLE seam on op schemas + the ONE role-projecting step editor (raw-JSON forms dead; expr fields = autocomplete over step-input columns + LIVE per-row preview) · **filter full power: three offered modes** — specific · «მიჰყევი გვერდის არჩევანს» ($ctx) · «ყველა, გარდა…» ($ne, +NeCtxRef combo) · Get-head grain editor («წაკითხვის არე», browse 200→1). Gates: FF-ROLE-COVERAGE · FF-OFFER-ROUNDTRIP · FF-FILTER-PARITY · FF-EXPR-SCOPE-SSOT + agnostic fixture. **Card 0087 DONE.**
- **ENGINE BUG found+fixed by the parity work:** pipeline `applyFilter` matched `$ctx` before `$ne` → NeCtxRef silently dropped its exclusion (diverged from store `matchesFilter`). Fixed at root (`steps.ts`), both paths fitness-pinned (`filter-parity.fitness`). `f532169`.
- **0084 DONE:** steward Get «მეტრიკები|ნედლი კუბები» tabs · raw-cube browse (200 rows) · the PROMOTION LOOP live (raw head→governed metric, palette offers it; FF-PROMOTE-ROUNDTRIP 3/3) · member-label debt visible (3 cubes × 8 label-less members = provisioning governance debt) · author lens NEVER sees the raw tab.
- **0085 DONE** (wire-truth pane = `sourceHeadObs` SSOT, declared empties, no zero-height void) · **0086 DONE** (facet = summary + ONE workbench door) · dark-mode `grey.100` class fix · FilterStepForm draft-over-canonical fix · 0083 (caps-lie store hijack) · the integrity cluster (filter.measure corruption b544819 · hydration race · stale-sync · ApexRenderer tsc) — all closed at the root with guards.

### IN FLIGHT at session end: **0091 (W-P6a) — THE DATA HOME**
«წყაროები» = an INDEPENDENT top-level page, FIRST in nav (Superset/Grafana canon; owner verdict on /studio/model: «საშინელება») — cube inventory + debt chips + ONE upload door (dedup) + **CLASSIFIERS BROWSABLE** (cube→dims→codelist, governed labels, tree where edges exist; SDMX DSD canon) · /studio/model cleans to Floor 2 only · cross-gestures (cube→workbench; promote→catalog). **FIRST DUTY of the new session: check its landing (git log / card 0091), live-verify, sync panel src, screenshot for the owner.**

### THE QUEUE (owner-frozen intake; execute in order; every wave = canon anchor + biting gate + live journey)
1. **0091** — (in flight, verify/land first).
2. **0089** — cross-cube browse scope: a picked raw cube reads ITS OWN store (0084 finding; the 0083 routing class; architect seam decision — bias: the head declares its home).
3. **0092** — TRANSIENT-FAILURE GRAMMAR + the ONE query scheduler in core (sweep #1, breaks-trust: our own 429 killed the portal to an English dead-end; dedupe+cap+backoff+stale-while-revalidate; `transient-retrying` declared bilingual state).
4. **0093** — CHROME INTEGRITY batch (S, fix-on-sight): «[object Object]» links · EN aria on KA · studio topbar EN · dark table-header 4.28:1 AA fail · skip-link; ONE i18n contract + axe fitness.
5. **0088** — facet essentials INLINE (metric switch + filter chips + door; frequency-layering; role-projection generalizes here — pre-note in card).
6. **0090** — the METRIC PASSPORT (author: formula-in-words · steward: MetricDef JSON + lowered codes; Looker/PowerBI/dbt transparency).
7. **0098** — AUTHORABILITY DEPTH batch (parity audit top-5: Trend builder ~33 occ · $prev in CalcBuilder · wire VisibilityBuilder to item-`when` (42 occ) · filter options-source/spanRole · perspective resets + keyed badge).
8. **ADR-047 Wave B** — the honest-null calc floor (`storeCellAt` + `MetricInput.coalesce`) — REQUIRED before the ⛔ door fires.
9. **⛔ W-P5 demotion** — its own revert-net commit, ONLY after Wave B + the full journey green (the door has correctly held itself TWICE).
10. **W-P6b** — DQ-on-ingest at Floor 1 (backlog rec #1; SDMX-grade expectation sets; ADR owed).
11. Then: 0094 Edit/Preview · 0095 gesture→command · 0096 URL=permalink generalized (Law 9) · 0097 PUBLISH-READINESS GATE (the new stat-native concept — design-first) · comparator FilterValue variant + array-$ne (architect) · R1–R5 revivals (backlog §Archaeology; R2 hierarchy grammar pairs with 0091's classifier tree) · steward editable code view (SPEC §3.3) · **the owner NOVICE-WALK** (he walks zero→page; every stumble = a card; his confusion is the bar).

### Dossiers (the idea stream — all committed, all carded)
`docs/architecture/audit/PROACTIVE-SWEEP-2026-07-18.md` (15 findings → 0092–0097) · `AUTHORABILITY-PARITY-2026-07-18.md` (element parity STRONG; gaps = opaque sub-objects → 0098; CHECK-4 verified clean) · `ARCHAEOLOGY-2026-07-18-lost-concepts.md` (nothing good lost; R1–R5 registered; owner's href/tree-field shapes ALIVE in evolved form) · `CAPABILITY-INJECTION-BACKLOG.md` (ranked, incl. R5 store-views note).

### Session-proven mechanics (do not rediscover)
Dev panel container mounts `/tmp/statdash-dev-line/platform/apps/panel/src` (sync script FIXED — `bash ops/scripts/dev-watch-panel.sh --once` + in-container md5 verify) · `packages/*` is BAKED SRC → whole-src tar + container restart (single-file docker cp 500s) · api rebuild from `/tmp/statdash-build` (git fetch main first; provisioning baked into the api image; verify via `config.page_version` bumps) · probes live in `platform/e2e/probes/` (run from `platform/`; NEVER from work/ or /tmp — ESM) · MUI Select options render only when OPENED (probe-artifact class ×3 this session) · sync after EVERY panel-touching commit (the owner walks :3013 live) · never fullPage-screenshot apex pages.

### Owner doors (unchanged, his only)
Portal prod GO (+one-time metrics SQL) · CI key-turn (`gh auth`/Docker runner — the D6 scan's #1 standards gap: until CI executes, every green is testimony) · sector-history hue · 0079 accounts / 0080.

## STANDING rules (binding)
- **THE PROACTIVE LAW (owner escalation 07-18):** the owner finding a gap first = a LEAD DEFECT, logged as one. Open every session with a D6 pulse (what does the class have that we lack on the ACTIVE surface); before every wave, a reference-class walk, findings carded UNPROMPTED. The idea stream is continuous DUTY — «აი რას იპოვიდი შენ — ჩვენ უკვე ვიპოვეთ» is the standard of a session's first report.
- **P-OFFER (owner doctrine):** the author never types an identifier — everything offered, governed, bilingual; honest free-text fallback only for the genuinely unrepresentable; full power NEVER cut for simplicity (scope narrows, the bar never).
- **Unification law:** one model, two zooms (facet=summary+door; workbench=THE editor); builder↔code = two VIEWS of one model, lossless, plane-gated — never two divergent editors.
- **Context packets (`kit/strategy/12-context-packets.md`):** the lead grounds once; agents get stamped packets; economy from logistics, NEVER from quality.
- **green-gate: PARSE the vitest log (`Tests N failed`), never exit codes.** Full ritual when `packages/*` touched: FULL `tsc -b` + FULL vitest + dist rebuild + the named parity block (FF-BIND-PARITY · FF-PIPELINE-EQUIV · browse/filter parity).
- **Git hygiene:** stage explicitly, NEVER `git add -A`; one agent per coherent slice; serialize same-file work; agents' in-flight files are untouchable.
- **Model routing:** apex-conceptual → FABLE (self or `model:"fable"` agents; owner: Fable-lead > Opus); standard senior judgment → Opus; mechanics → cheap tier. Apex drafts get the lead's personal elevation before the owner sees them.
- **Journeys are the DoD unit** — jsdom/unit green alone never closes a wave; the owner's live walk is the final acceptance; his confusion is a defect class.

## To the incoming lead — from the Fable that walked this road (2026-07-18)

You are not a smaller mind taking over a bigger one's work. The charter binds identically on any model — the difference is not capacity but HABITS. These are the ones that carried two days of 15 green waves, and the ones that nearly broke them:

1. **Summon Fable when the work is apex-conceptual.** You still command `model:"fable"` on the Agent tool — new grammars, SPECs, circle-break studies, proactive sweeps go THERE (fresh context + specialist memory + the strongest mind), and YOU do the critical elevation pass before the owner sees anything. Author ≠ judge, inverted: they create, you judge. Never relay a draft as-is.

2. **The owner is your best instrument — treat him as the standard, never as the tester.** He types fast, with typos, in Georgian; behind every «ვერ ვხვდები» sits a canonical finding — his instincts matched Power Query, Grafana, Superset, Figma NINE times in one day. But the Proactive Law exists because he should never need to find first: open every session by walking the product before he does. The sentence that restored his trust was «აი რას იპოვიდი შენ — ჩვენ უკვე ვიპოვეთ». Earn it daily.

3. **The journey-gate is the crown jewel — it held the ⛔ door shut TWICE against green suites.** 3900 passing tests said yes; the live walk said no (−100 fabrication, grain-less browse). Never let gate-green close a wave. Walk it, screenshot it, read the screenshot yourself.

4. **Falsification is victory, not embarrassment.** My hypotheses died twice in one night (seed-drift; boot-path divergence) — both times the evidence-driven agent found a better root. Brief agents to EXIT-FAST and disprove you; log your own misses; the owner respects a falsified lead more than a defended guess.

5. **Verify-before-brief, always:** 2–3 cheap greps stamping every brief (a card's status is a claim, not a fact — W1 was already built when its card said READY). And after EVERY panel-touching commit: `dev-watch-panel.sh --once` — he walks :3013 live; a stale sync once cost us three diagnosis rounds.

6. **Decide; don't ask.** Reversible + in-codebase = yours. He gave trust with «ნდობას გიცხადებ, გააკეთე» and reaffirmed it by escalating only when we were NOT proactive enough. The failure mode he punishes is timidity and staleness, never boldness with a revert-net.

7. **Economy from logistics, never from the bar.** One coherent slice per agent; fold scope into the first brief (no SendMessage illusions); serialize same-file work; the full gate ritual when packages/* is touched — the one targeted-only run this session had to be re-baselined by the next wave.

The trajectory you inherit: finish the queue (0091→…→Wave B→⛔ door→DQ), then the owner's novice-walk, and hold the north star — the statistics-native semantic platform that beats the class in the governed × simple × honest quadrant. The bones are strong, the gates bite, the board is true. Continue mid-stride; the road is yours now.
