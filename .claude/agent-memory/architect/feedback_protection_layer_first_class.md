---
name: protection-layer-first-class
description: In foundation/root-concept reforms, the owner requires the protection layer (regression-guard FFs + enforcement/discoverability) to be FIRST-CLASS and landed EARLY as a fence — never an end-of-plan afterthought
metadata:
  type: feedback
---
When authoring a foundation reform plan (root-concept / object-model class), the **protection layer is a first-class deliverable**, designed before and landed *inside* the build, not appended at the end.

**Why:** 2026-07-12, ADR-041 (the Part-grammar / Part-port foundation, Option A on the Fable diagnosis 0067). The named failure mode the owner is guarding against is the "roots-missed circle" — per-kind bridges (BE-1/BE-4/BE-5), each locally lawful (generic, declared, fitness-gated) yet globally a symptom because containment had four grammars. The owner's explicit directive: *"guard the plan so we can NEVER drift back."* A peer had authored a strong phase plan but framed the fitness fns as one-shot "scaffold → hard" proofs and spread them late (one guard only *began* at Phase 4 — the exact "fence at the end" the owner rejects), with no enforcement/discoverability layer at all.

**How to apply:** in any such plan, make the protection layer its own section + a dedicated early phase (I used "Phase 1.5 — THE FENCE", gating the rest). It has four parts:
1. **FFs as REGRESSION GUARDS via a monotonic ratchet** — each guard forbids any NEW old-shape site from day one, with a *shrinking* allowlist grandfathering the sites the migration will remove; a meta-assertion (`allowlist.length ≤ baseline`) fails the build if anyone grows it; the last strike flips it to a `[]` zero-tolerance gate. State exactly what each FF scans and what illegal pattern trips it, and give each a BITES test (a planted violation IS caught — not vacuous).
2. **Extend the existing anti-special-case FF** with the new bridge shape (here: a port adapter keyed by a concrete TYPE rather than by RESIDENCE).
3. **Enforcement + discoverability layer, minimal set, assigned by the repo's SSOT doctrine** (`.claude/kit/hooks/post-edit-laws.py` header): FFs = SSOT for content invariants; a non-authoritative check-laws `law_pattern` tripwire for the never-legitimate reintroductions a regex sees cleanly; eslint `no-restricted-imports` only for genuinely import-shaped guards (e.g. banning re-import of a deleted module) — do NOT push grandfathered/shrinking content invariants into eslint `no-restricted-syntax` (a blunt AST ban reds the build on legal migration-window code).
4. **A binding one-line LAW** for the module + root CLAUDE.md, a Registry §0 line, and a resume-brief "root-law-first" line — hand the owner the exact paste-ready text (the owner registers these). This makes the root the FIRST thing a future session sees and the build mechanically refuse to violate it.

Deliverable was `docs/architecture/proposals/PLAN-part-grammar-strangler-build.md` §0.5. See the diagnosis at `docs/architecture/proposals/SPEC-object-model-foundation-diagnosis.md` and `docs/architecture/decisions/ADR-041-part-grammar-and-part-port.md`.
