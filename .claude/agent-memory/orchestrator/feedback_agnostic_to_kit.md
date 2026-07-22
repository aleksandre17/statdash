---
name: agnostic-to-kit
description: "Owner rule (2026-07-22): everything AGNOSTIC — true on any project, not specific to this one — lives in .claude/kit/ (the agnostic space); only THIS-repo facts stay in agent-memory. Apply at every memory creation and curation."
metadata:
  type: feedback
---
**Rule (owner, 2026-07-22, verbatim):** «ეს წესად ჩადე, რომ ყველაფერი რაც არის აგნოსტიკური, რაც არის, არა კონკრეტული ამ პროექტის მხოლოდ, გადაიტანე kit-ში, რადგან იქ შეიქმნას აგნოსტიკური სივრცე» — everything agnostic (portable to ANY codebase: doctrine, lessons, disciplines, tools) is moved to `.claude/kit/` so the kit becomes the agnostic space; only THIS-repo facts (seams, topology, program state, owner decisions) stay in `agent-memory`/project memory.

**Why:** the kit travels across projects (submodule/upgrade model); portable wisdom trapped in project-local memory is lost to the next project. This elevates the pre-existing INDEX.md governance line ("agnostic lesson stored as project memory → graduate it") from a memory-hygiene note to a standing, owner-blessed sorting rule for ALL content.

**How to apply:**
1. **At creation:** before writing any memory/doc, ask "is this true on ANY codebase?" → yes: it belongs in `.claude/kit/` (feedback/ for lessons, strategy/ for doctrine, hooks/ for enforcement) with an INDEX.md load-condition row; no: agent-memory/project memory.
2. **At curation:** every curation pass (mine and any agent's — fold into curation briefs) includes a graduation check; graduating a lesson = move + INDEX row + remove the local copy (one body, never both).
3. **Anti-duplication guard:** before graduating, grep the kit — if the agnostic core already lives in a kit file (e.g. leadership/verification doctrine, strategy/12), EXTEND that file rather than adding a twin; the project memory keeps only the project-specific anchor/incident if one exists.
4. Mixed files (agnostic rule + project incidents): the rule graduates; generic incidents go with it as evidence; repo-specific anchors stay behind only if independently load-bearing.

First execution: `feedback_worktree_isolation_policy` graduated to `kit/feedback/feedback_worktree_isolation.md` (2026-07-22); full cross-dir graduation sweep carded (0105).
