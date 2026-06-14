# /verify — Health-check the deployed system playbook

> Invoke: "verify" · "doctor" · "is everything wired?" · "check it's all wired" · run after `/bootstrap`, after `/upgrade`, or anytime you doubt the setup.

**Who:** Sonnet (mechanical verification — no judgment needed).
**Output:** a per-check report + HEALTHY / list of issues.
**Done when:** `doctor.py` reports `HEALTHY ✓` (every check passes).

## Procedure

1. **Run it:** `python .claude/kit/tools/doctor.py`. It is read-only (one throwaway temp file, auto-cleaned) and exits 0 = healthy, 1 = issues.
2. **Read the ✗ lines** — each names exactly what is unwired. Common fixes:
   - manifest invalid → a field is missing/typed wrong; fix `.claude/project.json` against `.claude/kit/project.schema.json`.
   - hook self-test fail → `python` not on PATH (use `python3` in `settings.json`), or a hook edited.
   - live hook doesn't fire → `settings.json` not wiring `.claude/kit/hooks/` (re-run `/bootstrap`).
   - missing agent / specialist / allowlist gap → re-run `/bootstrap` (regenerates agents + syncs the orchestrator allowlist).
   - missing slot → re-run `/bootstrap` (scaffolds it, never overwrites).
3. **Re-run** until `HEALTHY ✓`.

## What it actually verifies (the verification architecture)

Beyond "files exist", doctor proves the **enforcement layer fires** on *this* project's config:
- **manifest valid** vs schema · **hooks self-test 8/8**.
- **LIVE:** `pre-edit-gate` flags a Class-M path built from the manifest's triggers; `post-edit-laws` actually **BLOCKS** a synthetic `law_patterns` violation (`sample_violation`). This is the difference between "the rule is written down" and "the rule stops a bad edit".
- **agent layer:** orchestrator + role agents present · one specialist per module · orchestrator `Agent()` allowlist ⊇ those specialists.
- **wiring:** `settings.json` defaults to `orchestrator` and wires all five hooks to `.claude/kit/hooks/`.
- **slots + INDEX:** every project slot present; every playbook + strategy file listed in INDEX.

> Hard enforcement (hooks, model routing, allowlists) is what doctor can *prove*. Process discipline (brief format, hunting-dog, refusal) is biased by always-loaded `CLAUDE.md` + the SessionStart operating-contract injection — strong, but not machine-verifiable. To make more of it hard, encode the rule as a hook (`08` — fitness functions).
