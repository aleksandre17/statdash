# /layer — Run one layer end-to-end playbook

> Invoke: "build Layer N" · "do layer X" · "next layer". The core loop — intake → gate → brief → build → validate → audit → learn → rotate.
> A playbook **guides**; routing per density is judgment (`01`).

**Who:** Sonnet runs the loop (intake, gate, brief, validate, rotate). Builder = Opus / Sonnet / Haiku per decision-density (`01`). Opus for any Class-M layer.
**Reads:** `opus-brief.md §Current State` · the layer's goal (from `<paths.roadmap_file>`) · relevant `strategy/` + `CLAUDE.md` laws (selective, `INDEX`).
**Output:** the code/diff · a layer record → `<paths.layers_dir>/LAYER-N.md`.
**Records:** `opus-brief §Current State` updated (≤80 lines) · learning note if an arch concept was touched (`07`) · token-log line.
**Done when:** Gate 2 green · audit clean (no hardcode/DRY/P-law/one-body breach) · brief + layer-doc updated.

## Procedure
1. **Intake** — Intake Echo + user's words (`01` A). Confirm the layer goal is a *system-state invariant*, not a step list.
2. **Pre-Work Gate** (`01`) — Class-M? → Mandatory-Opus + `09` §B. Else Decision Inventory → density routing.
3. **Brief** — compose per `03` (verbatim user-directive block default; Decision Inventory if Opus). Gate 1: "would the agent make a suboptimal call with only this?"
4. **Build** — agent works; Opus surfaces discovered problems (`03`: blocker→fix-first, connected→fix-on-sight, unrelated→log).
5. **Gate 2** — compile + tests. Fail → diagnose → repeat.
6. **Along-the-way audit** — hardcode? DRY? one-body? P-laws? boundary? (`02`). Quick fixes in-place.
7. **Record + rotate** — update `§Current State`; push the 4th-oldest layer detail → `<paths.layers_dir>`; learning note (`07`) if warranted; append token-log.
