# 07 — Learning System

> Loaded by Sonnet when a learning note is triggered, or at session close. ~30 lines.
> Format + teaching standard → `07-A-learning-format.md` (the "how to write a note" doc).

---

## Trigger

Every layer with an architectural concept, pattern, or non-obvious decision → learning note.

Decision rule: **"Would you encounter this again in a different project?"** → YES = write the note.

---

## Path & index

- **File path:** `docs/learning/phase-N/[layer]-[concept-slug].md`
  Example: `docs/learning/phase-1/1.2-port-adapter-seam.md`
- **Index:** `docs/learning/INDEX.md` — one line per note, updated every layer.

---

## Format

Format & teaching standard → `07-A-learning-format.md`. Summary:

> Problem → Solution → Analogy → Principle → Code → Career value

---

## Engineering laws

→ **Canonical: `CLAUDE.md` §Non-negotiable laws.** Module-specific laws (e.g. DB rules) → the module's `CLAUDE.md` per `project.json` module_law_docs (on-demand). Not restated here — one source, no drift.

---

## Session-close checklist

| When | File | Action |
|------|------|--------|
| Every session | `.claude/context/opus-brief.md §Current State` | Sprint progress, gates, next steps — **overwrite** |
| Every session | `.claude/context/opus-brief.md §Last Session` | What happened — **overwrite** |
| Every layer | `docs/layers/LAYER-X.Y.md` | New file: status, changes, decisions |
| Every learning note | `docs/learning/INDEX.md` | One-line entry |
| Debt resolved | `memory/project_debt.md` | Remove resolved item |
| Layer complete / >150 lines | `.claude/session/context.md` | Rotate (see `05-context-protocol.md`) |
| Rotation | `.claude/session/token-log.md` | Archive or clear |

**Sacred — never update unless architecture changes:**
`CLAUDE.md` · `memory/project_roadmap.md` · `memory/project_vision.md` · `memory/user_profile.md` · `docs/plan/IMPLEMENTATION-ROADMAP.md`