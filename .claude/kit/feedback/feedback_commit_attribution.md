---
name: feedback-commit-attribution
description: "Commits must be in user's name only — no Co-Authored-By Claude line"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5c388280-5e2a-4d4b-b89d-441410642aea
---

Never add `Co-Authored-By: Claude ...` to commit messages. Commits are attributed solely to the human owner (per the repo git config), never to Claude. Claude must not appear in git history.

**Why:** the owner requires commits in their own name; Claude/AI must not appear as author or co-author.

**How to apply:** Strip the `Co-Authored-By:` trailer from every `git commit` command in this project. Commit message body only, no co-author attribution.
