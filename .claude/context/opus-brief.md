# Opus Brief — durable resume state

## Current State (2026-07-08)

**Render-parity epic — DONE, LIVE, MERGED (2026-07-02).** Every chart/table/KPI renders "data as it was" (correct pre-regression values) via clean architecture, proven Δ0.000 through the real pipeline and verified live on prod (Playwright vs :3002). Detail archived in `docs/architecture/proposals/SPEC-render-pipeline-target*.md` + the parity harness under `platform/apps/geostat/src/data/`.

**Post-parity work landed on `main`:**
- AR-45 chart decomposition — `cartesian` build.ts is a thin assembler; responsive/grid/chrome/axes/marks/data-labels extracted; seam locked by `cartesian-decomposition.fitness`.
- Featured preliminary badge (config-gated, default on); regional hbar full-number x-axis; provisioning GDP-methodology PDF repoint.

**This session (2026-07-08) — `.claude` harness hardening:**
1. Recovered a phantom working-tree wipe of `platform/packages` (451 files, ~41k lines) — restored from HEAD (HEAD was intact; working-tree-only loss).
2. **Hook-suite hardening — 12 findings**, on branch `chore/hook-suite-hardening` (committed + pushed; PR pending manual open, `gh` not authed). Highlights: mass-deletion/working-tree-loss guard (Tier A session-boundary + Tier B pre-bash, WARN-only, `_worktree.py`); selftest now targets the LIVE manifest (was falsely green on a stale Java template) → 24/24; `memory-home-guard` 2394ms→29ms (81×); secret-scan law; eslint = single SSOT for the dependency arrow (**ADR-0033**).
3. **Claude-harness economy audit → applied**: removed stale/contradictory "always-Opus" memory entries (silent-Opus hazard), de-duplicated model-per-task doctrine, pinned `model` floors on judgment agent defs (opus) + explorer (sonnet), refreshed this brief.

## NEXT (resume here)
- Open/merge the `chore/hook-suite-hardening` PR when the owner approves.
- Then the parked **innovation initiatives** ([[proactive-innovation-mandate]]): (1) Grammar of Interaction / cross-filter, (2) formal semantic/metrics layer (Cube/Malloy/LookML class), (3) data lineage/provenance surface — register in `docs/architecture/ARCHITECTURE-REGISTRY.md`, architect-design the owner's pick, sign-off, build.

## STANDING rules (binding)
- **green-gate: PARSE THE LOG (`Tests N failed`), NOT exit code** — `pnpm test` returns 0 even when vitest fails. Include `pnpm lint` + `tsc -b apps/panel` in the converged gate.
- **MODEL ROUTING** — agent defs stay model-agnostic EXCEPT the invariant-tier extremes: apex design/QC (`chief-engineer`, `architect`, `platform-architect`) pin an `opus` floor + `junior-executor` pins `haiku`. Middle tiers carry NO pin — the orchestrator routes per-call by decision-density and must NEVER mis-route. Bias to Opus for substantive/real-engineering/judgment work; Sonnet/Haiku only for genuinely trivial mechanical; when unsure → Opus (owner: economy secondary to quality). SUPERSEDES the old "always Opus" rule.
- **Proactive-innovation mandate** ([[proactive-innovation-mandate]]) — be initiator; register visions in `ARCHITECTURE-REGISTRY.md`; design via architect + owner sign-off before building.
- **Owner granted autonomy** for en-route improvements (within DoD, no degradation); principled refusal even against the owner when a directive would degrade the project.
- chart==table asserted ONLY for same-section dual-view; different panels may have different data pipes.
