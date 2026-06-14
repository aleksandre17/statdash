# /bootstrap — One-word setup playbook

> Invoke: **"bootstrap"** · "init" · "set up this project" · "get it ready".
> Run once on a freshly-copied/cloned project. Sonnet makes it ready; you answer only what can't be inferred.

**Who:** Sonnet (orchestrates setup; Opus only if the architecture is genuinely ambiguous).
**Reads:** the repo tree · existing `CLAUDE.md` (if any) · `.claude/kit/templates/`.
**Output:** a valid `.claude/project.json`, scaffolded slots, a seeded `opus-brief.md`, a READY report.
**Done when:** manifest valid · selftest 8/8 · slots present · `law_patterns` reflect `CLAUDE.md` · `§Current State` seeded.

## Procedure

1. **Run the engine:** `python .claude/kit/tools/bootstrap.py`. It auto-detects the architecture (modules, migrations, contracts, build files, languages), drafts `project.json`, scaffolds every missing slot from templates (never overwrites), validates against the schema, and runs the hook self-test. Read its report.
2. **Reconcile the manifest:**
   - Fresh project → `project.json` was written from detection.
   - Existing project → the draft is at `.claude/project.detected.json`; Sonnet merges anything new into `project.json` (confirm ambiguous bits with the user), then deletes the draft.
3. **Clear the judgment TODO** (the report lists it — these can't be inferred):
   - `law_patterns` — turn the project's `CLAUDE.md` laws into forbidden-pattern regexes (glob + regex + msg). If `CLAUDE.md` is still the template → ask the user for the stack + the non-negotiable laws (a few sharp questions, `01-A` A), write them into `CLAUDE.md`, then derive the patterns.
   - `module_law_docs`, `lang_codes`, and per-module DB/contract docs.
4. **Seed the present:** if `opus-brief.md` is the template, either write the first `§Current State` from the user, or run **`/architecture`** to establish current→target→gap, then **`/roadmap`**.
5. **Confirm ready:** re-validate the manifest + re-run `selftest.py` → expect valid + 8/8. Report READY + the daily rhythm (`resume → /layer|/refactor|/debt → /review → /close`).

## What "ready" means honestly
- If the project already has a real `CLAUDE.md` + the kit vendored (the common case) → bootstrap detects everything, scaffolds the rest, and it **is** ready: laws read from `CLAUDE.md`, hooks fire on detected triggers.
- If it's an empty shell → bootstrap hands you a *filled draft* + a short TODO (vision, laws, examples). One word gets you ~80% + a precise checklist for the human-judgment 20%.
