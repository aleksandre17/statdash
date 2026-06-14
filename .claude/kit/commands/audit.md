# /audit — Architecture & Code Audit playbook

> Invoke: "run an audit" · "audit `<scope>`" · "review the architecture/module".
> A playbook **guides** — it fixes structure, routing, and where output lands. The *findings* are Opus's judgment (`03` hunting-dog), never a checkbox script.

**Who:** Opus does the audit (smell/coherence detection = judgment). Sonnet orchestrates: scopes, may parallelize **by module** — run `09` §A first (file-overlap/dependency check), then spawn one Opus per module if independent (cost-gated, ~7×). Sonnet never audits itself (that is doing Opus's work).
**Reads:** the scope's code · `CLAUDE.md` laws + `project.json` `law_patterns` · `memory/project_debt.md` (don't re-find known debt — `06` no-re-walk).
**Output:** `<paths.audit_dir>/<date>-<scope>.md` (e.g. `docs/audit/2026-06-03-ingestion.md`).
**Records:** actionable findings → `memory/project_debt.md`; trivial fixes done in-place (fix-on-sight, `03`); anything irreversible/high-blast → `09` §B before touching.
**Done when:** every module/layer in scope is covered and `project_debt.md` reflects the new actionable items.

## Procedure

1. **Scope + plan.** Name exactly what's in scope. Decide serial vs parallel-by-module (`09` §A). Pull existing `project_debt` so known items aren't re-reported.
2. **Scan each unit against the standard** — *judgment, not a checklist*; the list below is a floor, not a ceiling:
   hardcode / domain literals · DRY · SOLID (SRP/DIP/OCP) · loose coupling done wrong · gaps (missing lib capability) · one-body violations · `law_patterns` · Clean-Architecture boundary leaks · anything below Senior standard.
3. **Rank** each finding: `severity` (blocker / high / medium / low) + `reversibility` (one-way / two-way).
4. **Write the audit file** — table: `id | location | finding | law/principle | severity | proposed fix | effort`.
5. **Disposition:** small + safe → fix now (note it). Large or irreversible → backlog to `project_debt.md` + (if irreversible) `09` §B note. Never silently fix a high-blast item.
6. **Report** to the user: top findings first, undistorted (`01-A` D), with the file path.

## Quality-attribute lens (ISO/IEC 25010 — audit against these, not only code smells)

Score the scope against the product-quality attributes, not just style: **functional suitability · performance efficiency · compatibility · usability · reliability · security · maintainability** (modularity / reusability / analysability / modifiability / testability) **· portability** — plus scalability, observability, evolvability. Name the attribute each finding threatens; architecture is the art of trading these against each other, so state the trade-off, don't pretend it's free.

**Fitness functions.** The enforcement layer — hooks + `project.json law_patterns` (`08`) — *is* a set of automated fitness functions (tests that assert architectural rules: dependency direction, layering, forbidden patterns). Part of the audit: for each rule that *should* hold, is there a fitness function enforcing it, or is it only prose? A rule enforced only by prose is a gap → propose a `law_patterns` entry so it holds by default.

Anti-pattern checklist + quality-attribute catalog: `.claude/skills/architecture-standards/SKILL.md` §3–4 — name which anti-pattern each finding is and which ISO 25010 attribute it threatens.

## Output file shape

```
# Audit — <scope> — <date> (auditor: Opus)
Summary: <N findings: X blocker, Y high, …>. Overall: <coherence verdict>.

| id | location | finding | principle | severity | fix | effort |
|----|----------|---------|-----------|----------|-----|--------|

## Fixed in-place this pass
## Backlogged to project_debt (ids)
## Cross-cutting / systemic (→ /architecture if structural)
```
