---
name: memory-home-resolution
description: The native memory tool resolves memory: project RELATIVE TO THE AGENT'S CWD (not CLAUDE_PROJECT_DIR, not ancestor-walk) — why strays recur and how the single-home SSOT is enforced
metadata:
  type: project
---

The native memory tool (`memory: project` in every agent's frontmatter) resolves its store **relative to the agent's current working directory**: it creates/uses `<cwd>/.claude/agent-memory/<agent>/`.

**Why (evidence, decisive):** `platform/.claude/agent-memory` was created by a sub-agent while root `.claude` already existed as an ancestor. An ancestor-walk-to-nearest-`.claude` could never create a home strictly *below* an existing one — only cwd-direct creation explains a child home. Confirmed twice more: the two package homes sat at exactly `packages/core` (engine-specialist's module) and `packages/styles` (plugins-specialist's module), not at `packages/` where the CLAUDE.md marker is. The tool does NOT read `$CLAUDE_PROJECT_DIR` (that env var only steers the hooks in settings.json) and does NOT walk up. So the 2026-07-01 reorg's premise ("memory always writes to CLAUDE_PROJECT_DIR=repo-root") was false — that only fixed the hooks.

**How to apply:** You cannot prevent a cwd-relative stray from being *created* (the tool is closed). Do not attempt a CLAUDE_PROJECT_DIR/env fix — it is ignored by memory. The structural fix is self-healing: `.claude/kit/hooks/memory-home-guard.py` runs on SessionStart + SubagentStop + Stop (wired in settings.json AND kit/settings.template.json), idempotently relocating any non-root `.claude/agent-memory` into the root SSOT (moves files; identical dups skipped; name-clash → `*.relocated.md` so nothing is lost; stray MEMORY.md bullets appended under an "## Auto-relocated" block to reconcile). doctor.py's "single memory home" check is the CI backstop. Net invariant: a second home survives at most one agent turn, then reconverges — divergence is impossible. When you see a `*.relocated.md` file or an "Auto-relocated" index block, fold it into a proper topic section.
