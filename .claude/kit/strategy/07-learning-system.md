# 07 — Learning System

> Loaded by Sonnet when a learning note is triggered, or at session close. ~30 lines.
> Format + teaching standard → `07-learning-system.md` (the "how to write a note" doc).

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

Format & teaching standard → `07-learning-system.md`. Summary:

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

---

## Learning note format (absorbed from 07-A)

> Companion to `07-learning-system.md` (which owns *when/where*; this owns *how to write one*). Mirrors the `03` / `03-A` split.
> Load only when actually writing a learning note. Trigger + path + index → `07`.

# Learning Note Format — `docs/learning/phase-N/[layer]-[concept-slug].md`

> Why this file exists: the owner's **ULTIMATE goal** (`user_profile.md`) is to design Senior-level architecture independently. Every layer with an architectural concept produces one note in this exact shape. Trigger + path + index rules: `.claude/kit/strategy/07-learning-system.md`. This file is the *how to write one*.

Language: **clear, simple prose, with an everyday analogy** (the owner's working language). A note a future colleague (or future-you) can read without re-opening the code.

## The six sections (in order)

```markdown
# [Layer X.Y] <Concept name>

## 1. Problem
What was the issue? What was bad/missing before? (2–4 sentences, concrete — not "it could be improved".)

## 2. Solution
What we did. The shape, not line-by-line. Which pattern/port/abstraction and why it works.

## 3. Analogy
One everyday analogy that puts the concept in your palm. (This is the part that builds recall, not recognition.)

## 4. Principle
Which general principle stands behind it (SOLID/pattern/CAP/coupling/…)? **"Why this, not that?" — name ≥2 rejected alternatives and why.** (Can't name them → you haven't learned it yet — `commands/senior.md` Part 2.)

## 5. Code
The smallest characteristic snippet, or file:line reference. Not the whole diff — only the piece where the concept lives.

## 6. Career value
Where else will you meet this in another project? What does it teach you as a Senior? (Decision rule: "will I meet it in another project?" → yes → the note was worth it.)
```

## Quality bar for a note
- Predict-before-reading: before you open the agent's output, write 3 bullets — how you would solve it. The difference is your curriculum.
- One reversal awareness: now and then, note "what I'd revisit now". (`docs/decisions.md`, append-only — Senior portfolio.)
- No ceremony: 6 sections is enough. A long note is a bad note.

## Enforcement
A learning note is a **layer-close gate** (`02-layer-flow.md` §Continuous Audit + `07`): an architectural concept was touched → the note is mandatory before the layer closes. `docs/learning/INDEX.md` — a one-line entry per note.
