# 02 — Per-Layer Flow & Gates

> Loaded by Sonnet when running a layer. ~50 lines.
> Sibling files: `01-team-and-decisions.md` (who runs), `03-opus-mandate.md` (how to brief).

---

## Flow diagram

```
Layer N start
      ↓
Sonnet: lean read — only files this task needs (see .claude/kit/INDEX.md)
      ↓
Sonnet: 01-team-and-decisions.md → Sonnet / Opus / Haiku
      │
      ├── Haiku ──────────────────────────────────┐
      │                                           │
      ├── Sonnet alone ────────────────────────── ▼
      │                                      [GATE 2]
      └── Opus (--f or --b):                      │
            [GATE 1 — Brief quality]              │
            "Would Opus make a suboptimal         │
             decision with only this brief?"      │
            YES → enrich brief first              │
            ↓                                     │
            Brief (03-opus-mandate.md)          │
                → Opus executes                   │
            + Continuous audit:                   │
              hardcode · module laws · DRY · one-body   │
              · anti-patterns · packaging gaps    │
            + Tier 2? → STOP + report to Sonnet   │
            ↓                                     │
            [Tier 2 path]                         │
            Sonnet relays → User decision         │
              approve → plan in next layer        │
              defer → memory/project_debt.md      │
            ↓                                     │
[GATE 2 — Validation] ◄────────────────────────┘
compile + test → PASS → continue
              └→ FAIL → Sonnet diagnoses + fixes → Gate 2 repeat
      ↓
Sonnet: context.md rotation check (before writing Gate 2 result)
        IF lines > 100 OR completed layers since last rotation ≥ 3:
          → rotate: clear context.md, update §Last Session in opus-brief.md
        IF token-log.md > 40 lines OR ≥ 5 layers since last rotation:
          → archive to token-log.archive-YYYY-MM-DD.md, keep last 5 lines
        §Current State: ≤ 3 layer blocks. If new block pushes count > 3 → archive oldest to docs/layers/LAYER-X.Y.md first.
        context.md "Active layer" header: update atomically at EVERY layer start.
      ↓
Sonnet: spot-check (architecturally sensitive files only)
        one-body check: "Config/Registry/Pool/Factory in service instead of platform-*?"
        Sonnet does NOT re-process Opus output — spot-check only
      ↓
Sonnet: relay findings to user
        informational → continue
        decision required → user approves → Layer N+1
      ↓
Learning note (if architectural concept identified) → docs/learning/phase-N/
INDEX.md update
      ↓
Layer N+1
```

---

## Gates

| Gate | What | Who | Trigger |
|------|------|-----|---------|
| **1 — Brief quality** | "Would Opus make a suboptimal decision with only this?" | Sonnet, before send | Every Opus brief |
| **2 — Validation** | Compile + test pass | Sonnet, after agent run | Every layer with code change |
| **3 — Phase Retrospective** | Coherence, drift, cross-layer violations | Opus (full phase scan) | Phase end (~10–15 layers). Max 7 calls per 70-layer roadmap. |

> **Gate 3 also closes the feedback loop** (the measurement is otherwise a half-loop): at each phase retrospective Sonnet reviews the **token rollup** (`session-end-tokenlog.py` output) and the **brief-quality trend** (Steps-disguised count, `feedback_opus_brief_style`), and records any pattern in `06` / `project_debt.md`. This is the owner+cadence the metrics need.

---

## "Along the way" — Continuous Audit (every layer)

Layer "complete" means: code works **AND** hardcode? module laws? DRY? one-body? next-phase ready?

A layer never closes with a known quality violation. Handle anything seen on the path by the **discovered-problem protocol** (`03` Observation Duty): blocks/contaminates the current task → fix it FIRST, then resume; connected → fix-on-sight or note; unrelated → log to `memory/project_debt.md`. Never silently drop it. The rationale is economic, not only quality: leaving it = re-walking the same path later = double tokens (`06`), and it is how architecture erodes (`09`).