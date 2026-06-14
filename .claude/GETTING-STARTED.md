# GETTING STARTED — first session with this system

The operating system is ready. This is the moment it meets the codebase. Run top to bottom.

---

## Phase 0 — One word (≈30 sec)

On a freshly-copied project, just tell the AI: **`bootstrap`**. It runs `/bootstrap` — auto-detects your architecture, scaffolds every missing slot, validates the manifest, and self-tests the hooks (8/8). It then hands you a short TODO of the judgment-only bits (laws, vision, examples). Then run **`/verify`** — the doctor live-fires the hooks against your config and must report **HEALTHY ✓**. Clear the TODO and you're working.

Everything below is what `bootstrap` automates — read it only if you want to do it by hand.

## Phase 0b — what it does under the hood (≈5 min, manual)

1. **Placement.** Confirm the tree sits in the repo: `.claude/` (**agents/**, **skills/**, kit/, commands, context, session, settings.json, **project.json**) + `memory/` + `CLAUDE.md` (root) + `apps/ingestion-service/CLAUDE.md`.
2. **Lead model.** The main session runs the orchestrator role on whatever model you pick — **Sonnet by default** (economy); `/model opus` upgrades the lead for judgment-heavy sessions, `/model sonnet` returns. The role (routing, gates, mediation) binds identically on either.
3. **Validate the manifest:**
   `python -c "import json,jsonschema; jsonschema.validate(json.load(open('.claude/project.json')), json.load(open('.claude/kit/project.schema.json'))); print('ok')"`
4. **Self-test the hooks:** `python .claude/kit/hooks/selftest.py` → expect **8/8 passed**. (No `python` on PATH? use `python3` and update `settings.json` command prefix.)
5. **Hook posture:** leave WARN (default). Promote a discipline to hard-enforce (`stop-check.py: WARN_ONLY=False`) only if it keeps getting skipped. `post-edit-laws` already enforces (exit 2) — that's intentional.

## Phase 1 — Orient (first real session)

6. The **SessionStart hook** injects `opus-brief.md §Current State`. Read it.
7. **Heed any `⚠ STALE RESUME WARNING`** — it means the brief's last-migration claim ≠ the repo. If so, reconcile before trusting anything.
8. **Do the one thing only you can do (#2):** the brief's `§Current State` has an internal inconsistency — it lists `f, g, n pending` but `n` reads done elsewhere, and `l`/`m` are ✓ without layer-docs. **Open the repo, confirm what's actually done, and fix `§Current State`.** Everything resumes from this line; 2 minutes now prevents confident-wrong work later.

## Phase 2 — First productive loop (the recommended path)

Your standing concern was "layers don't harmonize → refactor." Turn it into a plan, don't refactor blind:

9. **`/architecture`** — Sonnet briefs Opus, read-only, full-scope → `docs/architecture/` `current.md` · `target.md` · `gap-and-path.md`. (This is the Gate-3 deliverable.)
10. **Review the PATH with fresh eyes** — you own plan-level (`01` E). Approve / reorder.
11. **`/roadmap`** — turn the path into phases → layers (goal · who · risk · DoD) → `IMPLEMENTATION-ROADMAP.md`.
12. **Execute the top item:** `/refactor` (one coupling/DRY hotspot) or `/layer` (one increment). Start with the highest coherence-win, reversible-first (`09` §B). fix-on-sight economy compounds from here.

## Phase 3 — Close every session

13. **`/close`** — rotate `§Current State` (≤80 lines, older → `docs/layers/`), append token-log, learning note if an arch concept was touched, update `project_debt`, name open threads in `§Last Session`. The Stop hook warns if you forget; this does it.

---

## Daily rhythm (quick reference)

`resume (read §Current State)` → `/layer` or `/refactor` or `/debt` → `/review` (if Sonnet built) → `/close`.
Assess when drifting: `/audit` (a module) or `/architecture` (the whole). Plan when scope grows: `/roadmap`. Phase end: Gate 3 (coherence + feedback-loop review).

## If something feels off
- First: **`/verify`** — the doctor pinpoints the broken piece (manifest · hooks · agents · slots).
- Wrong resume → check the STALE warning + reconcile `§Current State` (Phase 1).
- A hook misbehaves → `selftest.py`; it fails open (warn, never block). Disable fast in `settings.json`.
- Sonnet doing Opus's judgment-work → that's the anti-pattern; re-route (`01`).
- Changing a project path/law → edit `project.json` only, never a kit file.
