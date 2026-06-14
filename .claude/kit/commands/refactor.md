# /refactor — Fix one structural hotspot to completion playbook

> Invoke: "refactor X" · "fix the coupling/DRY/SRP in Y" · executes one item from `/architecture` path or `project_debt`.
> Refactoring is judgment + irreversible-adjacent → Opus-led, risk-gated.

**Who:** Opus (the fix IS judgment). Sonnet orchestrates + relays. Irreversible/high-blast (contract, schema, public API) → `09` §B + user sign-off before touching.
**Reads:** the hotspot · its callers/dependents (blast radius) · `CLAUDE.md` laws · `project_debt` (the item).
**Output:** the refactor diff · tests proving behavior preserved.
**Records:** close the `project_debt` item · learning note if the fix teaches a pattern (`07`).
**Done when:** the smell is gone · behavior preserved (Gate 2 green) · no new coupling introduced · one-body holds.

## Procedure
1. **Risk first (`09` §B):** reversibility · blast radius · degradation · premise · rollback. Irreversible + high-blast → STOP, escalate to user.
2. **Characterize** — what's the actual smell (DRY / SRP / DIP / coupling / God-object / leaky boundary)? What's the target shape? (one-body home, correct dependency direction.)
3. **Safety net** — tests cover current behavior before changing it. None → add characterization tests first.
4. **Refactor in the smallest reversible steps** — each step Gate-2-green. Prefer shadow/parallel over big-bang where the change is irreversible.
5. **Verify no degradation** (No-degradation law) — same behavior, better shape. Check callers.
6. **Record** — close debt item; note the pattern if reusable.

> Pattern catalog (incl. Strangler Fig for incremental replacement, ACL, resilience): `.claude/skills/architecture-standards/SKILL.md`.
