# /upgrade — Pull kit bug-fixes & improvements playbook

> Invoke: "update the kit" · "upgrade" · "pull kit fixes" · "refresh the kit".
> The kit gets bug-fixes and improvements over time. This pulls them into THIS project safely. Your `project.json`, `CLAUDE.md`, memory, and slots live OUTSIDE `.claude/kit/`, so they are never touched.

**Who:** Sonnet.
**Reads:** `.claude/kit/VERSION` (current) · the kit's `UPGRADE-NOTES.md` (what changed).
**Output:** the kit advanced to a newer version; a compatibility verdict.
**Done when:** `bootstrap.py --check` reports `COMPATIBLE ✓` (manifest valid + selftest 8/8).

## Procedure

1. **Pull the kit** (it's a submodule — your code is untouched):
   - `git submodule update --remote .claude/kit` (or `cd .claude/kit && git pull`), then commit the new pointer.
   - Copied (not submodule)? replace the `.claude/kit/` folder with the new kit; leave everything else.
2. **Check compatibility:** `python .claude/kit/tools/bootstrap.py --check`.
   - **`COMPATIBLE ✓`** → the fix is in, nothing to change. Done.
   - **manifest FAIL** → a kit update added/changed a required `project.json` field. The message names it; add it to `.claude/project.json` (see `.claude/kit/project.schema.json` + `templates/project.json.template`), re-check.
   - **selftest FAIL** → rare; means the new hooks need something (e.g. `python` path). Fix per the failing check; hooks fail-open so you're never blocked meanwhile.
3. **Read `UPGRADE-NOTES.md`** for any behavior changes worth knowing.

## Why this is safe
- A pure bug-fix (e.g. a hook logic fix) changes only files under `.claude/kit/` → propagates transparently, zero project changes.
- A contract change (new manifest field) can't silently break you: `--check` validates `project.json` against the new schema and tells you exactly what to add.
- You pin a kit commit, so upgrades are deliberate — you're never surprised by an upstream change mid-task.

## Found a kit bug yourself?
Fix it **upstream in the kit repo** (not in your vendored copy — that would diverge), bump `.claude/kit/VERSION`, then every project gets it via `/upgrade`. Never patch `.claude/kit/` in place.
