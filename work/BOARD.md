# BOARD — statdash-platform · the ONE managerial window

_Projection, not a register (curated by the lead at every stage event; last: 2026-07-20)._

> **ACTIVE PROGRAM (2026-07-20): Data-Workspace Unification — card `0104`** (ADR-051 "one data workspace, source is step 0" + ADR-046 Add.4/5). Shipped+live on :3013: DU1–DU3 · persistence · DU4a/b (timeseries+growth fold) · Step A · F2 · authoring-hold (**saving PAUSED by default**). Data restored: regional + GDP portal charts 1&2 + orphan-scratch purge. **⚠️ A capability REGRESSION shipped (DU3+Step A dropped editor power — R1–R6) → capability-parity is now a HARD pre-gate.** NEXT: finish capability restoration → **fully unify the two editing pipelines into one complete + beautiful surface** (owner-directed) + the 5-item DESIGN redistribution + DU6 visual refresh. Full handoff in `work/items/0104-*.md`.

> **The register rule (binding):** status truth lives in exactly THREE places — the **master plan** (`docs/architecture/ROADMAP-zero-to-hero.md`), the **vision registry** (`docs/architecture/ARCHITECTURE-REGISTRY.md`), and the **cards** (`work/items/`). This board only PROJECTS them for a manager's glance; git history is the shipped log. If this board ever contradicts those sources, the sources win — fix the projection, never fork a status here.

## Where we are (Stage 1 of 3 — see the ROADMAP for the whole arc)

| What | State | Next action | Owner gate |
|---|---|---|---|
| **Portal review notes batch** (card 0078) | ✅ **CLOSED ON DEV 2026-07-17** — all docx notes + R2 + R3 craft wave at `9130f4b`; **r4 walk 17 PASS / 0 FAIL light+dark** on :3012 (`walk-r4.mjs`, `r4-*.png`); roots closed: seed-provenance merge `9766092` (the (B5G) class) + ComboInterpreter palette `7003ee3` | show the owner the r4 evidence → his prod GO (incl. one-time metrics SQL touch) | ⛔ **owner door: prod deploy** |
| **Stage 0 — CI resurrection** (card 0077) | 🟡 config-correct (filters fixed, lint+panel-typecheck added, V33 hazard flagged) — UNPROVEN | turn the key: `gh auth login` + push & watch (lead iterates on the V33 fresh-migrate hazard) | ⛔ **owner door: gh-auth OR Docker runner** |
| **W1 — Honest Canvas** (card 0071) | 🔨 ~60% landed, live-proven on :3013 (live-default+veil, unbound-KPI affordance, `FF-CANVAS-NEVER-LIES` biting) | engine `Cell{value,state}` seam → brand-into-manifest → dev-image rebuild → close on J3 walk | ⏳ **owner GO pending** |
| W2 — Semantic spine lived (0072) | blocked on W1 | — | per card |
| W3 — Inspector as instrument (0073) | blocked on W2 | — | per card |
| W4 — Manipulate lands (0074) | blocked on W3 | — | ⚠️ contains the one-way transport flip |
| W5 — Publish closes the loop (0075) | blocked on W4 | — | per card |
| Stage 2 — conservation horizon · Stage 3 — framework proof | sequenced in the ROADMAP | one at a time, post-Stage-1 | per stage |

**Standing discipline:** WIP = 1 stratum · a wave closes ONLY on its journey (J1–J6) walked live on :3013 · every close is shown to the owner · new ideas mid-wave → registry cards, never build slots · launch-freeze in effect (owner 2026-07-15) — nothing spawns without his word.

## Program documents (the thinking, in order)
1. `docs/architecture/proposals/STUDY-authoring-canon-circle-break.md` — AR-52: the live-probed product study; Canon C1–C4 (now CLAUDE.md Law 11)
2. `docs/architecture/audit/DEEP-2026-07-15-*.md` — the five-lens deep expedition (platform · system · engine · data · coherence)
3. `docs/architecture/proposals/CONCEPT-power-of-the-core.md` — AR-53: Conservation of Declared Truth (the synthesis)
4. `docs/architecture/GUARDRAILS.md` — the insurance architecture (prevention → detection → containment → recovery; audited at every stage close)
5. `docs/architecture/ROADMAP-zero-to-hero.md` — **the master plan** (Stage 0→3, hero checklist H1–H7)
6. `work/items/0070–0075` — the wave cards, briefed for execution

## Recently shipped (headline only — git is the log)
- 2026-07-15 · W1 increments `49c2555`/`918c515`/`d01a193` (honest canvas, first 60%) · AR-52/53 program docs · `.claude` harness overhaul (context-packet doctrine, governor charter, duty orders, memory healing)
- 2026-07-13 · ADR-042 ACCEPTED + Slice 0 (Placement seam) + D3 (section de-privileged)
- 2026-07-12 · ADR-041 Part-grammar foundation (Phases 1–6) + Studio IA S1–S6 + AR-42 Phase 1

## Historical epochs (archived registers — read-only, superseded by this projection)
`work/board/render-pipeline.md` (the render-parity epic, DONE 2026-07-02) · the long per-epoch tables that used to live in this file survive in git history (`git log -- work/BOARD.md`) — deliberately not carried forward: a board is a window, not an archive.
