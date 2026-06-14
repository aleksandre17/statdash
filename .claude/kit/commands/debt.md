# /debt — Take and close a backlog item playbook

> Invoke: "close debt X" · "tackle the next debt item" · "work the backlog".

**Who:** Sonnet picks + scopes; builder per density (`01`); Opus if the item is judgment/Class-M.
**Reads:** `memory/project_debt.md` (the item + its context) · related code.
**Output:** the fix (often a `/refactor` or `/layer`) + updated `project_debt.md`.
**Records:** mark the item DONE with the commit/layer ref (don't delete — strike through / move to a "Closed" section so history survives, `12` archive principle).
**Done when:** the item's acceptance condition is met, verified (Gate 2), and `project_debt` shows it closed with a pointer.

## Procedure
1. **Pick** — highest-value / unblocking item; check it isn't stale (already fixed). Confirm acceptance condition.
2. **Route** — small mechanical → Sonnet/Haiku; structural/judgment → `/refactor` (Opus); a feature increment → `/layer`.
3. **Execute** via the right sub-playbook (risk-gated if irreversible).
4. **Close honestly** — update `project_debt`: DONE + ref. If partially done, split: record what remains as a new item (no silent half-close).
