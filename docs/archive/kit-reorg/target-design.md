# `.claude` Operating-System — Canonical Target Design

> Architect design spec for owner sign-off. **Nothing has been moved/deleted.** This is the target-state + reversible migration plan.
> Mandate: one SSOT, nothing scattered/duplicated, load exactly what is necessary, German-clock precision.
> Evidence base: `platform/work/kit-reorg/audit.md` (explorer) + this session's investigation of the memory mechanism, hooks, and rendered-layer drift.
>
> **GOVERNING PRINCIPLE (owner-set): Single Source of Truth (SSOT).** Every artifact has exactly ONE canonical origin; all other copies are *generated projections* reached by ONE unidirectional path (origin → derived), never a hand-maintained copy and never a bidirectional sync. Corollaries: DRY (no duplicated hand-written content); "generate, don't copy". This is why Decision-1 rejects sync (option D) and why the harness-required rendered layer is kept only as a guarded projection of `kit/`.

---

## 0. The linchpin finding (settles Decision 1)

**The native memory home is FIXED by the harness at ROOT `.claude/agent-memory/<agent>/`. It is NOT repointable.**

Evidence:
- Every agent declares `memory: project` in frontmatter (`.claude/agents/*.md` and `.claude/kit/agents/*.md`). This is the *only* memory control the harness exposes — an enum, not a path.
- `strategy/01` documents the derived path verbatim: *"`memory: project` gives each agent persistent memory at `.claude/agent-memory/<agent>/`"* — relative to `CLAUDE_PROJECT_DIR`, which is the repo root (`national-accounts/`).
- I searched `settings.json`, `project.json`, agent frontmatter, and all hooks: **there is no memory-path knob anywhere.** The path is derived by Claude Code, not configured.
- Consequence: the tool will *always* write to ROOT `.claude/agent-memory/`. The tracked `platform/.claude/agent-memory/` copy is a **manual mirror** — and manual mirrors drift (exactly what happened: ROOT is pre-rename/wrong-project, platform is current).

**Therefore the explorer's "platform is canonical" is content-correct but location-wrong.** You cannot make the tool write to `platform/`. The only ways to reach "tool writes to the one canonical, tracked home":

| Option | Guarantee | Verdict |
|---|---|---|
| **A. Make ROOT the tracked canonical** — un-ignore `.claude/agent-memory/`, migrate current content in, delete platform copy | Tool writes exactly here; git tracks exactly here → **one physical dir, divergence structurally impossible** | **CHOSEN** |
| B. Symlink ROOT→platform | Windows junction/admin fragility, git-symlink cross-platform hazard, harness may replace the dir | REJECTED (KISS / Least-Astonishment / portability) |
| C. Repoint tool to platform | No config knob exists | REJECTED (impossible on evidence) |
| D. Keep both, add a sync step | A process is not a structural guarantee — this IS the status quo that diverged | REJECTED (fails the mandate) |

**Decision 1 = Option A.** ROOT `.claude/agent-memory/` becomes THE canonical, **git-tracked** home. The tracked location is realigned onto the location the tool structurally writes to. One dir, one writer, tracked → German-clock.

This also fixes a latent doctrine contradiction: my own agent instruction says *"this memory is project-scope and shared with your team via version control"*, yet ROOT is gitignored. Un-ignoring makes the instruction true.

---

## 1. Target tree (final canonical layout)

```
national-accounts/
├── .claude/                          # OPERATING SYSTEM (kit + instance + memory), tracked except runtime
│   ├── settings.json                 # hooks wiring + permissions + agent:orchestrator            [harness-read]
│   ├── project.json                  # domain manifest — every generic hook reads this            [hook-read]
│   ├── README.md / HISTORY.md / GETTING-STARTED.md
│   │
│   ├── kit/                          # ==THE ONLY SOURCE OF TRUTH for doctrine==  (portable, project-agnostic)
│   │   ├── hooks/*.py                 # session-start / pre-edit-gate / post-edit-laws / stop-check / session-end / _manifest / selftest
│   │   ├── agents/  commands/  skills/   # editable SOURCE; rendered copies below are generated from these
│   │   ├── strategy/*.md             # doctrine 01..11 — LOADED ON DEMAND from here (not rendered)  [load-on-demand]
│   │   ├── feedback/  templates/  tools/
│   │   └── INDEX.md  B.md  VERSION  project.schema.json  settings.template.json
│   │
│   ├── agents/   (generated == render(kit/agents))    # REQUIRED at this path by harness           [harness-read]
│   ├── commands/ (generated == render(kit/commands))  # REQUIRED at this path by harness           [harness-read]
│   ├── skills/   (generated == render(kit/skills))    # REQUIRED at this path by harness           [harness-read]
│   │   #  NO rendered strategy/  — deleted; strategy loads on demand straight from kit/strategy/
│   │
│   ├── agent-memory/   (TRACKED, canonical)          # native per-agent memory — the tool writes HERE
│   │   └── <agent>/ MEMORY.md + *.md                  # 13 active agents, one dir each              [agent-read on demand]
│   │
│   ├── context/opus-brief.md         # durable resume; §Current State is the ONLY auto-injected memory (~3.6KB) [hook-read+inject]
│   ├── session/
│   │   ├── mode                      # 1 word, injected by session-start                            [hook-read]
│   │   ├── context.md                # HOT handoff only (rotated, ≤ ~15KB); cold tail → docs/layers/ [manual-read]
│   │   ├── token-log.md              # HOT ledger only (rotated per period); overflow → session/archive/ [hook-read/append]
│   │   └── archive/                  # rotated token-log slices (gitignored)                        [cold]
│   │
│   ├── worktrees/                    # git-worktree runtime scratch (gitignored, runtime-created)
│   └── .gitignore                    # ignores: __pycache__, *.pyc, project.detected.json, session/archive/, worktrees/
│                                     #  NO LONGER ignores agent-memory/
│
├── docs/                             # tracked project docs (repo-root, referenced by project.json paths)
│   ├── architecture/decisions/       # ==ADR HOME== ADR-NNN-*.md first-class artifacts (giant design docs land here)
│   ├── layers/                       # cold session-handoff layers rotated out of session/context.md
│   └── ... (architecture, knowledge, patterns, rules, audit …)
│
└── platform/                         # THE CODE (packages/, apps/, work/)
    └── .claude/                      # ==REMOVED== agent-memory/ deleted after merge-into-root (one SSOT)
```

**What loads when (the "exactly necessary" contract):**
- **Every SessionStart (auto, ~5–6KB — unchanged/leaner):** opus-brief §Current State + mode + hardcoded contract/disposition blocks. Nothing else.
- **On demand only:** kit/strategy docs (via INDEX.md), per-agent MEMORY.md (when that agent runs), ADRs (when a decision is consulted), context.md/token-log.md (manual pull on resume).
- **Never auto-loaded:** context.md, token-log.md, agent-memory, ADRs. (Confirmed: no hook injects these.)

---

## 2. Decision table

| # | Decision | Chosen | Why | Trade-off |
|---|---|---|---|---|
| **1** | Canonical memory home | **ROOT `.claude/agent-memory/`, un-ignored + tracked; platform copy deleted after merge** | It is the *only* place the harness writes (`memory: project` path is not configurable). Aligning the tracked home onto the write target makes divergence **structurally impossible** — one physical dir, one writer, git-tracked. | Memory no longer sits inside `platform/` next to code (cosmetic). Repo now tracks memory churn (desired: it IS shared team knowledge). Requires a one-line kit-doctrine update (see D5 note). |
| **2** | ROOT 244-file triage | **Rule-based buckets** (below), not file-by-file | Junior-executor applies rules mechanically; specialists resolve content conflicts. | A few edge files need a human/specialist call (flagged). |
| **3** | Giant ADRs (20–40KB) | **First-class artifacts in `docs/architecture/decisions/ADR-NNN-*.md`; slim pointer left in memory** | ADRs are versioned-with-code design docs (kit canon §5), not agent scratch. The home already exists and is tracked. Removes the biggest bloat from the gitignored/native layer. | Two-hop: memory pointer → docs file. Acceptable; the pointer is the index, the doc is the SSOT. |
| **4** | Rotation of context.md / token-log.md | **Keep hot head at current path; archive cold tail on cadence** | Hooks read these exact paths — they must stay put. Trimming keeps "load exactly necessary" true long-term without breaking hooks. | Requires a periodic rotation ritual (a `/rotate` command or doctor nudge). |
| **5** | Rendered layer vs kit | **kit = sole source. Re-render agents/commands/skills (harness-required paths) + add drift guard. DELETE rendered strategy/ (harness does not read it; load from kit).** | Harness reads `.claude/agents|commands|skills/` but NOT `.claude/strategy/`. So the first three are mandatory generated artifacts; strategy rendered is pure cruft (1 orphan). | Re-render + guard is a small build step; without the guard drift recurs (that's why commands went stale). |
| **6** | Naming canon | **filename-prefix ≡ frontmatter `type` ∈ {user, feedback, project, reference}. `adr_` prefix retired from memory** (ADRs are docs artifacts). | One rule, zero mismatch. Today `adr_*` files carry `type: project` because the tool has no `adr` type — removing ADRs from memory dissolves the conflict. | Existing `adr_*` memory files must be renamed to `project_*` pointers or migrated out. |
| **7** | Empty/orphan dirs | **Remove empty agent dirs; keep the 13-agent set that has content; `worktrees/` stays as gitignored runtime scratch** | "Nothing scattered." Empty `junior-executor/`, `project-manager/` (root) carry no info. worktrees is a sanctioned runtime dir. | None material. |

**Decision-2 buckets (rules, not files):**
- **DROP (one-way, needs owner OK) — VERIFY EACH FIRST:** genuinely dead dated one-offs only (e.g. `reading-session-*`). ⚠ The audit's "wrong-project" premise proved UNRELIABLE (see geostat correction) → every delete candidate is individually verified before removal, never bucket-deleted.
- **KEEP + DEDUPE — geostat-kit recon (CORRECTION to audit):** `explorer/geostat-kit-*` documents a LIVE repo package `kits/geostat-kit` (verified present: ARCHITECTURE.md, cli, drivers, compose, contracts, manifest.schema.json). It is OURS, NOT wrong-project. **Do NOT delete.** Collapse the 3 redundant generations into the canonical numbered `01–07` set (SSOT), drop the unnumbered twins + duplicate mega-maps (41KB/18KB) as they are non-canonical copies, and fix stale `CursorProjects/geostat-chat-ai` refs → `kits/geostat-kit`. `national-accounts-workspace-structure.md` describes THIS repo → keep/refresh.
- **MIGRATE-AS-ADR:** any `adr_*.md` ≥ ~8KB → `docs/architecture/decisions/` (Decision 3), leave slim pointer.
- **MERGE (platform wins on conflict):** for every agent dir present in BOTH homes, platform content is *current* → overlay platform → root, keeping ROOT-unique files that describe live architecture with no platform twin.
- **KEEP-AS-IS:** ROOT-unique current files with no conflict.

---

## 3. Migration plan (ordered, reversible, phased)

All work on a branch (`chore/claude-os-reorg`); every phase is one commit → fully `git revert`-able. One-way deletes are called out and gated on explicit owner OK.

**Phase 0 — Safety net (you/architect).** Create branch. `git tag pre-reorg-snapshot`. Confirm working tree clean of the in-flight session edits or stash them. *(two-way)*

**Phase 1 — Merge content platform → root (specialist per agent).** For each agent, reconcile `platform/.claude/agent-memory/<agent>/` (current) over `ROOT/.claude/agent-memory/<agent>/` (may be stale/pre-rename). Specialist tier because this is content judgment (which MEMORY.md wins, which uniques survive). Output: ROOT holds the union of *current* memory. *(two-way; nothing deleted yet)*

**Phase 2 — Extract giant ADRs → docs (specialist).** Move `adr_*.md` ≥ ~8KB into `docs/architecture/decisions/ADR-NNN-*.md`; consolidate the overlapping families (`adr_data_*` → one ADR with sections; `adr_*_vision`/`north_star`/`config_and_render` → one "Vision" ADR; `adr_constructor_*` → one). Replace each moved file with a ≤5-line `project_*` pointer memory. Update `project.json.paths.decisions_file` if you want it to point at the dir/index. *(two-way)*

**Phase 3 — Un-ignore + track root memory (you/architect).** Edit `.claude/.gitignore`: remove `agent-memory/`; add `session/archive/`. `git add .claude/agent-memory`. *(reversible)*

**Phase 4 — Re-render + guard the rendered layer (you/architect).** Re-render `.claude/commands/` (all 15 stale) and `.claude/agents|skills/` from `kit/`. **DELETE `.claude/strategy/`** (orphan; loaded from kit). Add a `doctor.py`/selftest check asserting `rendered == render(kit)` so drift can't recur. *(one-way delete of rendered strategy — trivially regenerable, low risk)*

**Phase 5 — Rotation setup (you/architect).** Split `session/context.md`: hot head stays, cold layers → `docs/layers/`. Truncate `token-log.md`: keep current period, overflow → `session/archive/`. Add a `/rotate` command (or doctor nudge at size threshold). Hooks untouched — paths preserved. *(two-way)*

**Phase 6 — Prune (junior-executor, GATED on owner OK — ONE-WAY).**
- **6a** Delete `platform/.claude/agent-memory/` (content now in root). ⚠ one-way.
- **6b** (CORRECTED — NO geostat delete) `explorer/geostat-kit-*` is KEEP+DEDUPE (Decision-2), done in Phase 1 as content merge, not deletion. Here: remove only genuinely dead dated one-offs, each verified first. ⚠ one-way.
- **6c** Remove empty agent dirs. ⚠ one-way (empty → trivial).

**Phase 7 — Naming sweep (junior-executor).** Rename any remaining memory file whose prefix ≠ frontmatter `type` (Decision 6). Update each MEMORY.md index line to match. *(two-way)*

**Phase 8 — Verify (you/architect).** Run acceptance test (§4). Merge.

**Hook-safety checklist (verified — no hook path moves in this plan):**
- `session-start.py` → `.claude/context/opus-brief.md` (§Current State), `.claude/session/mode`, `project.json.resume_marker` — **all unchanged**.
- `stop-check.py` → `.claude/session/token-log.md` + `opus-brief.md` — **paths preserved** (only trimmed).
- `session-end-tokenlog.py` → appends `.claude/session/token-log.md` — **path preserved**.
- `pre-edit-gate.py` / `post-edit-laws.py` → `project.json` — **unchanged**.
- **No hook reads `agent-memory/`, rendered `strategy/`, `context.md`, or any ADR** → the memory/ADR/strategy moves cannot break SessionStart injection.

---

## 4. Acceptance test ("German-clock precision" proof)

1. **Single memory home:** `platform/.claude/agent-memory` does not exist; `git check-ignore .claude/agent-memory/architect/MEMORY.md` returns nothing (tracked). The native tool, on next write, lands in the tracked dir (verify one write shows in `git status`).
2. **Zero duplicate topics:** no agent has the same topic in two homes (there is only one home). No `geostat-kit-*` / cross-project file remains (`git ls-files .claude/agent-memory | grep -c geostat-kit` = 0).
3. **Auto-load budget:** capture SessionStart stdout; assert ≤ 6KB and byte-identical-in-shape to today (never heavier).
4. **Hooks green:** `python .claude/kit/hooks/selftest.py` passes; a dummy SessionStart injects §Current State + mode with no errors.
5. **Rendered ≡ kit:** doctor/selftest asserts `.claude/commands|agents|skills` == render of `kit/`; `.claude/strategy/` absent.
6. **ADRs first-class:** every `docs/architecture/decisions/ADR-*.md` has ≥2 rejected alternatives; no memory file ≥ ~8KB remains (`find .claude/agent-memory -size +8k` empty).
7. **Naming law:** for every memory file, `prefix == frontmatter.type`; script exits 0.
8. **Rotation holds:** `session/context.md` ≤ ~15KB, `token-log.md` ≤ one period; older content present under `docs/layers/` and `session/archive/`.

---

## 5. Flagged for owner + one side-finding

- **Owner OK required (one-way):** Phase 6a (delete platform memory copy), 6b (delete geostat-kit set + dated one-offs). Everything else is reversible.
- **Owner choice — kit doctrine:** `strategy/05` currently says *"native memory = machine-local, ephemeral scratch."* Decision 1 makes it durable+tracked. Either (a) update the kit doctrine line (improves the kit for all projects — recommended), or (b) record it as an explicit project override so the portable kit stays neutral. Your call.
- **Owner choice — ADR consolidation depth:** merge the overlapping ADR families into 3 consolidated ADRs (aggressive, less duplication) vs migrate 1:1 and only cross-link (safer, more files). Recommend consolidate.
- **SIDE-FINDING (out of scope, but machine-relevant):** `project.json` `modules`, `law_patterns`, and `class_m_triggers` all point at `platform/engine/**`, but the code now lives at `platform/packages/**` (per CLAUDE.md law 3). The enforcement hooks are matching stale paths → **law patterns may not be firing on the real tree.** Worth a separate fix ticket; I did not fold it into this reorg.
