# /architecture — Current → Target → Gap → Path playbook

> Invoke: "current vs target architecture" · "where are we vs where we want to be" · "map the architecture" · the owner's standing concern ("layers don't harmonize → refactor").
> This is the **Gate 3** mechanism (`02`) made into a deliverable. Opus-led, full-scope, no edits during the assessment.

**Who:** Opus (architectural judgment, whole-system view). Sonnet orchestrates and relays undistorted. **Assessment is read-only** — no code changes until the path is agreed with the user (`01` authority; irreversible steps → `09` §B).
**Reads:** the full module tree · contracts/ports · data flow · `memory/project_vision.md` (the intended shape) · `project_roadmap.md` · `project_debt.md`.
**Output (three files in `<paths.architecture_dir>`):** `current.md` · `target.md` · `gap-and-path.md`.
**Records:** gaps → `project_debt.md`; the ordered path → feeds `/roadmap`.
**Done when:** current + target + gap + an ordered, risk-assessed migration path all exist and the user has seen them.

## Procedure

1. **CURRENT (describe what *is*, honestly).** Module map + dependency directions (who imports whom) · where contracts/ports live · data + control flow · datastores · the actual debt and where coupling/DRY break down. No aspiration here — only reality.
2. **TARGET (define what *should be*).** Derive from `project_vision` + the Senior standard: the intended module boundaries, dependency direction, contract placement, one-body homes. State the *invariants* the target guarantees (e.g. "application imports ports only", "no domain literals in code").
3. **GAP = TARGET − CURRENT.** Each gap = `{ what's wrong now, target shape, why it matters, blast radius, reversibility }`.
4. **PATH (ordered migration).** Sequence the gaps: dependencies first (a fix that unblocks others), **reversible / low-blast before irreversible** (`09` §B), highest coherence-win early. Each step: scope · risk class · rough effort · rollback. This is a *plan*, surfaced to the user — not executed here (`01` E: no silent decisions).

## Frameworks that structure the assessment (the Opus standard)

- **C4 model** — describe CURRENT and TARGET at the right zoom and don't mix levels: **Context → Containers → Components → Code**. Most "layers don't harmonize" pain is a Component-level boundary problem; name the level.
- **DDD** — module boundaries should be **bounded contexts**; name the ubiquitous language per context and the context map. A module that splits one context, or a context leaking across modules, is a gap (it shows up later as coupling).
- **ADR (Architecture Decision Record)** — every significant decision in the path gets an ADR appended to `<paths.decisions_file>`: *context · decision · consequences · ≥2 rejected alternatives + why*. This is the durable "why this, not that" (ties to `senior.md` Part 2 + the learning note §4).
- **ISO 25010 quality attributes** — TARGET states which attributes it optimises and which it trades; every significant decision names the trade-off explicitly.

## Output shapes

```
# Architecture — CURRENT (<date>)
Modules & dependency direction · contracts/ports · data flow · datastores · known coupling/DRY breakdowns.

# Architecture — TARGET (<date>)
Intended boundaries · dependency direction · contract placement · guaranteed invariants.

# Gap & Migration Path (<date>)
| gap | current | target | why it matters | blast | reversible? |
## Ordered path
1. <step> — risk <class> — rollback <how>
2. …
```

> The path feeds `/roadmap` (phases/layers). Refactoring then runs layer-by-layer through the normal flow (`02`), with fix-on-sight economy compounding (`06`).
