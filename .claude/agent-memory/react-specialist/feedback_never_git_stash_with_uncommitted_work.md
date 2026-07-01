---
name: never-git-stash-with-uncommitted-work
description: Never run git stash (or other working-tree-clearing git ops) while carrying uncommitted edits in this repo — it silently reverts all in-flight work
metadata:
  type: feedback
---

Never run `git stash` (or `git checkout .`, `git reset --hard`, etc.) while I have uncommitted edits in the working tree. The task standing-order is also "Do NOT touch git."

**Why:** During the color-SSOT task I ran `git stash` merely to inspect a clean baseline diff; it reverted every source edit I had made (none were committed). I had to `git stash pop` to recover, and the pop also restored two unrelated pre-existing modified files into my view. A wasted round-trip and a near-loss of work.

**How to apply:** To inspect a baseline for ONE file, use `git diff <file>` / `git show HEAD:<file>` (read-only) — never a stash. To revert ONE file deliberately (e.g. to re-apply a cleaner edit), `git checkout <specific-file>` is fine, but only that file and only when I intend to lose its changes. Default: keep hands off git entirely unless the user asks.
