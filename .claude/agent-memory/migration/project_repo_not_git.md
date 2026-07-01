---
name: repo-git-tracked
description: The national-accounts repo root IS git-tracked (verified 2026-06-14) — git mv / git-based rollback available for migrations
metadata:
  type: project
---

As of **2026-06-14** the repo root `C:\Users\Test-User\WebstormProjects\national-accounts` **IS a git repository**: `.git/` present, `git rev-parse --show-toplevel` returns the repo root, on branch `master`, initial commit `191bc0e` ("chore: initial commit — pre-platform migration snapshot"). Working tree was clean at migration start.

**History note:** An earlier memory (2026-06-14, same day) recorded the repo as NOT git-tracked and a Class-M migration was halted on that false premise. Git was initialized afterward. This supersedes that record.

**Why:** Class-M monorepo restructuring specs assume `git mv` for history preservation and git-based rollback. That premise is now satisfiable.

**How to apply:** Git-based rollback is available — the pre-migration snapshot commit is `191bc0e`. Still re-verify `git status` / `git rev-parse` directly before each migration rather than trusting this memory; state can change again. Note: `package-lock.json` was tracked at snapshot time, so deleting it during pnpm migration needs `git rm`, not plain `rm`.
