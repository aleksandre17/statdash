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

**The per-file mix is real and fine-grained** (confirmed W-P3 2026-07-18): sibling files
in the SAME dir differ — `packages/core/src/data/transform/index.ts` is CRLF at HEAD but
`step-registry.ts` / `verb-coverage.fitness.test.ts` right beside it are LF. Match EACH
file to its own HEAD (`git show HEAD:<f> | tr -cd '\r' | wc -c`), never the neighbour's.
**Don't chase `git diff --cached --check` "trailing whitespace" on a CRLF file** — it flags
every `\r` as trailing whitespace by design; that is BENIGN for a file whose HEAD is CRLF.
The real signal is the *numstat*: a clean content-only diff (small +/-) means the EOL is
correct; a whole-file churn (`74/68` on a 74-line file) means you flipped it. Normalize
deterministically with a python `b.replace(b'\r\n',b'\n').replace(b'\r',b'\n')` (→LF) then
optionally `.replace(b'\n',b'\r\n')` (→CRLF) to avoid the mixed-state you get from
round-tripping `sed`.
