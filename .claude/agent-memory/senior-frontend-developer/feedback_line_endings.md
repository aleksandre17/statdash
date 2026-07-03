---
name: line-endings
description: Edit tool can rewrite an LF file with CRLF on this Windows repo; verify and normalize EOL before committing
metadata:
  type: feedback
---

When editing existing source files in this repo, the Edit/Write tools can write
CRLF line endings into a file that was originally LF. Git then reports the ENTIRE
file as changed (e.g. `@@ -1,181 +1,204 @@`, hundreds of insertions/deletions)
even though the real edit was a few lines.

**Why:** the repo has mixed EOL per file (most TS is LF; some files like
`packages/react/src/engine/SiteRenderer.tsx` are CRLF). There is no `.gitattributes`
enforcing normalization, so a flipped EOL produces a whole-file diff that buries the
real change and pollutes the branch.

**How to apply:** before committing, check each edited file's diff with
`git diff --stat -w <file>` (ignore-whitespace) vs plain `git diff --stat`. If the
plain stat is huge but `-w` is small, the file's EOL flipped. Compare HEAD vs
worktree: `git show HEAD:<f> | grep -qU $'\r' && echo CRLF || echo LF` against
`grep -qU $'\r' <f>`. Normalize a wrongly-CRLF'd file back to LF with
`tr -d '\r' < f > f.tmp && mv f.tmp f`, then re-run its test to confirm intact.
Preserve whatever EOL the file had at HEAD — do not blanket-convert.
