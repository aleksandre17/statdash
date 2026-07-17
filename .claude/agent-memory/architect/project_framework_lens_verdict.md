---
name: project-framework-lens-verdict
description: The architect's framework/core-lens verdict on the "are we building a framework or circling?" review (2026-07-15) — snapshot, decays as waves land
metadata:
  type: project
---

Owner commissioned a five-lens deep review (2026-07-15) asking "are we really building a framework-level + platform-level system, or going on ANOTHER CIRCLE?" My lens = FRAMEWORK/CORE.

**Verdict: PARTIAL-but-converging (framework-grade substrate, executing the convergence — not circling).**
- Dependency arrow is REAL and executable (eslint `no-restricted-imports`, `platform/eslint.config.js`). `packages/core`/`react` carry zero Geostat coupling — the only "geostat" hits are code comments. Engine is genuinely tenant-agnostic.
- ADR-041 (one containment grammar, 9→4 concepts, Phase 6 landed with hard `[]` gate) + ADR-042 (Triprojection) are the settled substrate. Convergence at the OBJECT-MODEL level is real and machine-held.

**Why converge, not circle (the decisive signal):** the plan is being EXECUTED, not re-planned. Since the audit, PM-1 (the honest-state `Cell` seam, `packages/core/src/data/cell.ts`) LANDED and is ADOPTED (`KpiStateCard.tsx`, `kpi.ts` consume it), and the shipping tenant `geostat.provisioning.json` now carries 13 governed `"metric"` handles + a `type:metric` spec — the audit reported ZERO. The "cathedral without a congregation" is being populated.

**The ONE structural thing that keeps us circling if unfixed: no executing CI gate (Stage 0).** Every "green/BUILT/VERIFIED" is a manual laptop run; `.github/workflows/ci.yml` was stale (`@geostat/*` filters) + never run. A statistics platform whose law is "the canvas never lies" cannot verify its own truth automatically. This is the mechanical cause of "architectures that don't come out" — nothing holds the line while attention moves on. **Blocker is an owner door:** `gh` unauthenticated + no local Docker → gate cannot be proven green. Awaiting owner's `gh auth login` / Docker runner.

**Concept trend:** converging at object-model level; still PROLIFERATING at the META/read level — ~40 `register*` seams with no unified read model (`describeApp()` unbuilt), and "a published thing" modelled 5 ways with no shared `Publishable`/`Artifact` identity spine. PM-2 (the one `metric:` graph edge that turns lineage from prose into a read) is still ABSENT (`SRC` in `compilePage.ts` has no measure edge) — lineage-as-a-read is the most-repeated ADR claim and remains vaporware.

**How to apply:** if asked again about circle-risk, the honest answer is "the substrate converged; the risk now is verification (no running gate) + the meta-level un-unifications (projector meta-model, artifact identity) — refuse any new stratum before Stage-0 CI runs." Do NOT re-open the object model; that IS the circle.
