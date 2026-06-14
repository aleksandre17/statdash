# 10 — Architecture Protection (anti-erosion)

> Loaded when a change could affect structure, or when hardening the project's invariants. ~45 lines.
> Sibling files: `02` (per-layer flow + continuous audit), `08` (hooks = fitness functions), `09` (degradation risk), `03` (hunting-dog).

---

## Why architecture erodes "along the way"

No single edit breaks the architecture. Erosion is **cumulative**: each "small, reasonable" decision slightly bends a boundary, and over many layers the design rots. The owner's own standing concern names the end-state — *"layers don't understand each other, too much static and poorly-coupled code, not one coherent structure."* Protection therefore cannot be a one-time review; it must run **on every edit, every layer, every phase**.

## The erosion vectors → the defense for each

| Vector (how it creeps in) | Defense | When it fires |
|---|---|---|
| **Dependency-direction violation** (application imports infrastructure concrete) | `law_patterns` arch rule → `post-edit-laws` **BLOCKS** | per edit (hard) |
| **Layering / boundary leak** (a lib imports an app package; a module reaches into another's internals) | `law_patterns` arch rule (path-scoped glob) → **BLOCK** | per edit (hard) |
| **Coupling creep / God object / SRP drift** | continuous audit (`02`) + Opus hunting-dog (`03`) | per layer |
| **Duplication drift (DRY) / one-body violation** | one-body law + continuous audit; promote to shared lib | per layer |
| **Silent decision reversal** (a later layer quietly undoes an earlier architectural call) | **ADR** in `paths.decisions_file` + Opus refusal of regressive work (`09` §B) | per decision |
| **No-degradation breach** (lowers any existing guarantee) | Task-degradation risk check, `09` §B — BLOCK + escalate | before irreversible/high-blast |
| **Cumulative drift across many layers** | **Gate 3** phase retrospective (`02`) + `/architecture` re-baseline (current vs target) | per phase / on demand |

## The principle: every architectural invariant is a fitness function

The strongest protection is the one that does not depend on anyone remembering. **Turn each invariant into an automated check:**
- **Regex-expressible rules** (dependency direction, forbidden imports, layering, domain-literal bans) → a `law_patterns` entry. `post-edit-laws` matches the rule's `glob` against the file's **path** (path-scoped, e.g. `*/application/*.java`) and **blocks (exit 2)** the edit on violation. This is per-edit, hard, agent-independent.
- **Structural rules regex cannot express** (cycle detection, transitive dependency, "only these modules may depend on X") → an **ArchUnit / dependency-check test** wired as a CI gate (`ops/scripts/check-laws.sh`). Reference it from the manifest; run it in `/review` and at Gate 3.

A rule enforced only by prose erodes. A rule enforced by a fitness function holds **by default**, no matter who edits or how tired they are.

## Working rules (every agent)

- **No broken windows.** A layer never closes with a known architectural violation (`02` Continuous Audit). Fix-on-sight — the economic case is in `06` (leaving it = re-walk later = double tokens; here it also = erosion).
- **Touching a boundary is a Class-M signal.** Public API · contract · port · cross-module dependency → Mandatory-Opus + `09` §B before the edit.
- **Record the decision (ADR), not just the change.** So a future layer cannot silently reverse it without the reversal being visible.
- **Harden, don't just warn.** When `/audit` or `/architecture` finds an invariant protected only by prose, the fix is to **add the fitness function** (a `law_patterns` arch rule, or an ArchUnit test), not another reminder.
- **`/verify`** (`doctor.py`) proves the protection actually fires on this project's config — run it after `/bootstrap` and `/upgrade`.

## Prevention protocol (system hygiene — the four standing guards)

| Threat | Guard | Hardness |
|---|---|---|
| **File bloat** (huge files) | `hygiene.bloat_limits` — `post-edit-laws` **BLOCKS** any edit leaving a file over limit×hard_factor ("split, don't append"); doctor reports anything over the soft limit | hard + report |
| **Structure drift** (stray folders, wrong placement) | doctor checks `.claude/` against `hygiene.claude_sanctioned_dirs`; a new top-level home for anything is a **structure decision → Intake Gate + architect proposal**, never a silent mkdir | report + protocol |
| **Token weight** (system itself getting heavy) | on-demand loading (INDEX discipline, `06`): always-loaded surface stays minimal; new doctrine goes into load-on-trigger files, never the hot path | protocol |
| **Wrong plan from the user** (wrong folders/architecture in the request itself) | **Task Intake Gate** (orchestrator): standards pre-check covers structural plans — the lead pauses BEFORE work, names the violation, proposes the best-quality alternative; the user decides | protocol (binding) |

New architecture is always a **proposal first**: architect (Opus) presents options + trade-offs (SKILL catalog) → ADR → only then build. Nothing structural happens as a side effect of a task.