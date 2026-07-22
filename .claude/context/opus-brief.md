# Opus Brief — durable resume state

> **⛔ ROOT LAWS FIRST.** Containment = ADR-041 (one Part grammar · one port · residence-at-field). Authoring = ADR-042 (Triprojection: Select/Inspect/Manipulate over the one Part model). Product canon = **CLAUDE.md Law 11** (Data first · canvas never lies · projection with a plane · a journey is the unit of done). FF ratchets red the build on violations. A new kind is a DECLARATION, never a bridge.

## Current State (2026-07-22 — housekeeping session done; 0104 mid-stride)

**Branch `main` only. Working tree clean (orphaned authoring-hold test suite committed; repo-root ephemera → gitignored `work/live-shots/`; evidence backfilled; `.playwright-mcp/`+test-artifacts ignored). Panel 1275/0 · `tsc -b` clean as of `8abb6b8d`. Dev tier: :3013 studio / :3012 portal (admin/dev_admin_pw_123). ⚠ authoring-hold is ON — :3013 does NOT persist DataSpec edits (interim, `DEFAULT_AUTHORING_HOLD=true`, amber "Draft — not saving").**

### THE UMBRELLA — card `0102` THE CANONICAL PANEL IA (ADR-050 ACCEPTED, owner-blessed)
Spine: DATA→SITE→SKELETON(page-kind × PresetDecl)→PAGE→SECTION/ELEMENT→BINDING→PUBLISH. Verdict: engine canonical, PROJECTION missing. Remedy R1→R6 (R1=0101 in flight · R2=P2b presetRegistry · R3 skeleton FF-SKELETON-CHOOSABLE · R4 chrome-as-Parts · R5 Site rail · R6 publish). 0100/ADR-049 (assembly-by-declaration) is an element of it.

### THE ACTIVE CARD — `0104` data-workspace unification & capability restoration (ADR-051, the entry point; read the card — it is status truth)
- **Shipped (each live-J-walked):** DU1 one `/studio/data` workspace · DU2 courier deleted (URL one-shot seed) · DU3 one editing surface · persistence PUT (optimistic+debounced+honest chip) · DU4a/b value-cell `source` variant — timeseries + single-code growth fold byte-identical (ADR-046 Add.4; ratio/row-list deferred to Add.5) · Step A three-pane open · F2 cross-store fold honest '—' · authoring-hold `5506cc59` (+ its test suite, committed this session).
- **⚠ THE REGRESSION INCIDENT (owner lost trust):** DU3+Step A silently dropped R1–R6 editor capability. Root: proxy verified ("no duplicate"), not purpose ("survivor ⊇ removed"). **BINDING pre-gate now: capability-parity before ANY retire/merge (`feedback_capability_parity_gate`), DoD = "no capability lost".**
- ✅ **STEP 1 DONE (2026-07-22): restoration LIVE-VERIFIED 7/7** — chief-engineer QC walk, real gestures, evidence `work/authoring-truth/0104/`. All R1–R6 + writable raw JSON proven; query/pipeline still fold (no over-revert). 5 surfaced findings triaged into card 0104 §Elevation inputs (Law-11 plumbing-token leak in pivot/transform editors = the lead item; metric-facet false "not bound"; metric dedup; one-way pipeline convert; unguarded code free-text vs P-OFFER).
- **🔴 PRIORITY #1 — engine measure-drop bug (live Law-11 lie, NOT GDP-specific):** `buildObsFilterParam` (`core/src/data/store-filter.ts:65`) obs branch never pins top-level `q.measure` → measure-less fetch/cache key → sibling `query` charts differing only by measure render last-wins (GDP charts 1&2 live victims). Fix: pin `MEASURE_DIM` mirroring the val branch + a render-truth fitness (same dims/different measure → distinct series; warm-key≡read-key is why gates stayed green). Engine seam — full gate + live-render verify; deploy = `docker cp core/src`. Evidence: chief-engineer memory `project_obs_measure_drop.md`.
- **THEN — true unification (owner: "unify FULLY, with beautiful UI"):** ONE workbench authoring EVERY kind at FULL power, kinds re-admitted to the three-pane only on proven capability-parity; reference-class UI (Power Query applied-steps · Retool/Grafana single-flow · Airtable core-ops).
- **Queued (0104 §Queued):** DW-C→DU6→DW-A/B/D (5 owner UX items + Placement-Law routing via `resolveSurface.ts`) · visual refresh (GDP "structure good, visual outdated") · per-capita-stops-at-2017 gap · DU4 remainder (Add.5 explicit-cells → ratio/row-list; DU4e multi-code growth equivalence; then DU5 ⛔ flip) · data-integrity guards (draft→publish Save model, version history on config PUTs, PUT validation).

### Data restores (done 07-20, backups tracked)
Regional datasetCode restored (was silently reading GDP_ANNUAL) · 8 orphan scratch specs deleted (backup `work/data-spec-backups/`) · GDP page config byte-identical to provisioning — the chart lie is the ENGINE bug above, no PUT applied (backup `work/gdp-restore-backup/`).

### Session-proven mechanics (do not rediscover)
Deploy topology: dev container `statdash-dev-panel-full` bind-mounts only `panel/src`; `packages/*` BAKED → engine change = `docker cp core/src` + restart, never just `dev-watch-panel.sh`; "committed" ≠ "live" for packages/* · live-check against the REAL containers (192.168.1.199:3013/:3012, api :3011) — never boot a local panel · probes in `platform/e2e/probes/` run from `platform/` · sync after EVERY panel-touching commit · MUI Select options render only when opened · never fullPage-screenshot apex pages · `/api/config/pages` list omits `config` bodies — referenced-checks must fetch each page.

### Team hygiene (this session)
Agent-memory curation executed (orchestrator + engine-specialist + senior-frontend-developer were over ceiling; sfd's 57KB studio-map split). docs/+work/ merge considered and REJECTED (owner concurred): status lives on cards, knowledge in docs, linked — never copied.

### Owner doors (unchanged, his only)
Portal prod GO (+one-time metrics SQL) · CI key-turn (until CI executes, every green is testimony) · sector-history hue · 0079 accounts / 0080 · portal :3012 deploy batch (0092/0093 chrome + i18n catalog — ready, not fired).

## STANDING rules (binding)
- **THE PROACTIVE LAW (owner escalation 07-18):** the owner finding a gap first = a LEAD DEFECT, logged as one. Open every session with a D6 pulse; before every wave, a reference-class walk, findings carded UNPROMPTED. «აი რას იპოვიდი შენ — ჩვენ უკვე ვიპოვეთ» is the standard of a session's first report.
- **Capability-parity pre-gate** before ANY retire/merge/fold: enumerate the removed surface's FULL capability set FIRST; survivor ⊇ removed; fitness-guard it. DoD = "no capability lost", never "no duplicate".
- **P-OFFER (owner doctrine):** the author never types an identifier — everything offered, governed, bilingual; full power NEVER cut for simplicity.
- **Unification law:** one model, two zooms; builder↔code = two VIEWS of one model, lossless, plane-gated.
- **Context packets (`kit/strategy/12`):** the lead grounds once; agents get stamped packets; economy from logistics, NEVER from quality.
- **green-gate: PARSE the vitest log, never exit codes.** packages/* touched → FULL `tsc -b` + FULL vitest + dist rebuild + the named parity block; after parallel waves → FULL combined-HEAD suite.
- **Git hygiene:** stage explicitly, never `git add -A`; after an agent, reconcile `git status` FULL-set against its file list; one agent per coherent slice; serialize same-file work.
- **Model routing:** apex-conceptual → FABLE (self or `model:"fable"`); standard senior judgment → Opus; mechanics → cheap tier. Apex drafts get the lead's elevation before the owner sees them.
- **Journeys are the DoD unit** — the owner's live walk is the final acceptance; his confusion is a defect class.

## To the incoming lead — from the Fable that walked this road (2026-07-18)

You are not a smaller mind taking over a bigger one's work. The charter binds identically on any model — the difference is not capacity but HABITS:

1. **Summon Fable when the work is apex-conceptual** (new grammars, SPECs, circle-break studies, proactive sweeps) — fresh context + specialist memory; YOU do the critical elevation pass. Author ≠ judge, inverted: they create, you judge. Never relay a draft as-is.
2. **The owner is your best instrument — the standard, never the tester.** Behind every «ვერ ვხვდები» sits a canonical finding — his instincts matched Power Query, Grafana, Superset, Figma nine times in one day. But the Proactive Law exists because he should never need to find first.
3. **The journey-gate is the crown jewel** — 3900 passing tests said yes; the live walk said no. Never let gate-green close a wave. Walk it, screenshot it, read the screenshot yourself.
4. **Falsification is victory.** Brief agents to EXIT-FAST and disprove you; log your own misses (0104's GDP restore killed TWO wrong premises before the engine bug emerged — live render + network trace = truth).
5. **Verify-before-brief, always:** 2–3 cheap greps stamping every brief (a card's status is a claim, not a fact). After EVERY panel-touching commit: sync — he walks :3013 live.
6. **Decide; don't ask.** Reversible + in-codebase = yours («ნდობას გიცხადებ, გააკეთე»). The failure mode he punishes is timidity and staleness, never boldness with a revert-net.
7. **Economy from logistics, never from the bar.** One coherent slice per agent; fold scope into the first brief; serialize same-file work; full gate ritual when packages/* is touched.

The trajectory: live-verify the restoration → kill the measure-drop lie → unify beautifully (DU6/DW waves) → the ⛔ DU5 flip → the owner's novice-walk. The bones are strong, the gates bite, the board is true. Continue mid-stride.
