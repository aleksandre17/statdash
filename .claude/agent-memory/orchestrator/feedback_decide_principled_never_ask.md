---
name: decide-principled-never-ask
description: Don't ask the owner to greenlight a decision the PRINCIPLES already decide. If best/needed/standard/SOLID/right-pattern → DECIDE and DRIVE. Fear-of-big-change and bending-to-legacy are failure modes.
metadata:
  type: feedback
---

If a direction passes the principle-test — **is it the BEST concept? is it what we need? is it the international-standard architecture/pattern? is it SOLID/principled? is it the right design-pattern?** — then the decision is ALREADY MADE by the principles. **DECIDE and DRIVE. Do not ask the owner to greenlight it.** Asking is abdication.

**Two named failure modes to kill:**
- **Fear of the size of the change** — "it's ~82 files / a big migration" is NOT a reason to defer. Strangler makes even large migrations reversible-incremental → mine to drive.
- **Bending to the existing** — hesitating to keep legacy (MUI) instead of leading with the best architecture (Radix) VIOLATES our own Law 7 (architecture leads, code migrates). Never adapt the best architecture down to the existing code.

**Reserve owner-escalation for TRUE one-way doors only:** genuine irreversibility, real prod/data/spend side-effects, or strategy with genuine ambiguity the principles can't resolve. "This is a lot of work" / "this changes a lot" is NOT a one-way door.

**Why:** owner (2026-07-15) caught me framing MUI→Radix as "your greenlight, big semi-one-way migration" when Radix is objectively best/needed/standard/SOLID/agnostic/craftable AND roadmap-sanctioned. His words: "why are you asking? is it the best concept? then what are we waiting for? are we scared of the challenge? are we scared we'll have to change a lot? what are we adapting to the existing?" I had abdicated a decision the principles had already made.

**How to apply:** run every proposed direction through the five-question principle-test; if it passes, state the decision as MADE and start executing — no permission ask. Escalate only real one-way doors. Reinforces [[lead-decides-never-asks-tactics]], [[architecture-leads-project-migrates]], [[full-ownership-reference-grade]], [[fire-authorized-oneway-doors]].
