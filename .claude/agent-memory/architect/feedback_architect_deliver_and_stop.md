---
name: feedback-architect-deliver-and-stop
description: On foundation commissions the architect delivers ADR + plan doc (+ optional inert scaffold) and STOPS; the lead routes the phases and records the registry
metadata:
  type: feedback
---

On a design-lock / foundation commission, the architect's deliverable is the **ADR + the phased build plan + agent memory** — then STOP. Do NOT mass-build, do NOT commit.

**Why:** the owner/lead runs a phase-routing model — each phase is dispatched to the fitting role (engine-specialist for engine ports/grammar; react-specialist / senior-frontend-developer for app-side adapters/selection/anchor). The architect designs and sequences; specialists execute under the green-gate. Building ahead of routing pre-empts that.

**How to apply:**
- A scaffolded INTERFACE-signature file is allowed if it sharpens the design — keep it **additive/reversible and inert** (types-only, not wired into the barrel, nothing imports it) and SAY you wrote it. Verify its imports resolve so you don't leave the dist-baked package broken.
- Do NOT edit `work/` board files or `docs/architecture/ARCHITECTURE-REGISTRY.md` — those are lead-owned; the lead records from the architect's report.
- Recommend the owner-role per phase (a routing suggestion), don't assign.
- Method is Strangler-Fig / Law 7: if any phase can't stay reversible/zero-migration, FLAG it as the one-way step and gate it explicitly (like ADR-023's R2 contract step).
