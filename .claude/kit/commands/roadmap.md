# /roadmap — Implementation Roadmap playbook

> Invoke: "make/update the implementation roadmap" · "plan the phases/layers" · after `/architecture` produces a path.
> Turns a target + gap (from `/architecture`) into a phased, layered, routable plan.

**Who:** Opus designs the sequencing (ordering under dependency + risk = judgment); Sonnet maintains it after (crystallized updates).
**Reads:** `<paths.architecture_dir>/gap-and-path.md` · `project_vision` · `project_roadmap` · `project_debt`.
**Output:** `<paths.roadmap_file>` (e.g. `IMPLEMENTATION-ROADMAP.md`).
**Records:** the roadmap is the durable plan; as a layer completes it flows into `opus-brief.md §Current State` (and detail → `<paths.layers_dir>`).
**Done when:** every gap/target item maps to a layer with a goal, a routing call, a risk class, and a Definition-of-Done.

## Procedure

1. **Phases** — group the path into coherent phases (each phase = a milestone that leaves the system shippable/coherent).
2. **Layers within a phase** — slice each phase into layers small enough to validate independently (Gate 2). Order by dependency.
3. **Per layer, fill the row** (this is the template):
   - **Goal** — a *system-state invariant* ("After this layer: …"), never a step list (`04` A.2).
   - **Decision-density → who** — judgment-heavy → Opus; crystallized + wiring → Sonnet; templated → Haiku (`01`). Class-M? (`project.json class_m_triggers`) → Mandatory-Opus.
   - **Depends on** — prior layers/ids.
   - **Risk class** — reversibility + blast (`09` §B); irreversible → flag.
   - **DoD** — beyond "tests green": the quality bar this layer must meet (one-body, no hardcode, P-laws, the relevant invariant).
4. **Surface to the user** — the roadmap is plan-level; the user owns it (`01` E).

## Delivery & risk frameworks (apply per layer where relevant)

- **Deployment strategy for risky / irreversible layers** — pick and name one in the layer's rollback (`09` §B): **blue/green · canary · rolling · feature-flagged dark launch**. An irreversible layer with no deployment-safety strategy is under-planned.
- **SemVer + Conventional Commits** — contract/API layers bump version by compatibility (additive = minor, breaking = major); commit messages structured so changelogs/releases are automatable.
- **DORA metrics as the health signal** — deployment frequency · lead time for change · change-failure rate · time-to-restore. The roadmap's sequencing should not degrade these (e.g. don't batch a giant irreversible layer that tanks restore time).
- **ADR linkage** — a layer that embodies an architectural decision cites its ADR in `<paths.decisions_file>`.

## Roadmap shape

```
# Implementation Roadmap — <project> (updated <date>)
North star: <target invariant set>.

## Phase N — <milestone> (status)
| layer | goal (system-state invariant) | who | depends | risk | DoD |
|-------|-------------------------------|-----|---------|------|-----|
| N.1   | After this: …                 | Opus| —       | 2-way| one-body + Gate 2 |

## Done   (→ docs/layers/)
## In flight
## Next
```

> Completed layers roll up into `opus-brief.md §Current State` (≤80 lines, last 3 layers; older → `<paths.layers_dir>`). The roadmap is the *plan*; the brief is the *now*.
