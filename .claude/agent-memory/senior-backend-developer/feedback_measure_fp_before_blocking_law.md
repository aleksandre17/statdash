---
name: measure-fp-before-blocking-law
description: before adding a BLOCKING (exit 2) law_pattern to the kit manifest, measure false-positive counts across the repo; skip whole-file constructs that can't be scoped
metadata:
  type: feedback
---

Before adding a new BLOCKING `law_pattern` (post-edit-laws.py exits 2, halting the edit) to
`.claude/project.json`, grep the ACTUAL codebase for the candidate regex and count matches. Ship only
patterns with near-zero legitimate matches.

**Why:** `law_patterns` run against the WHOLE edited file with a coarse glob (e.g. `*.ts*`) — a regex
cannot tell a DataSpec config literal from renderer code. Bare-construct patterns over-match
catastrophically and would block the build: measured in this repo, bare `if/switch(` = 2461,
`=>` = 7292, `fetch(` = 21, `val(` = 6. Only config-KEY forms (`getRows:`/`val:`/`fetch:` assigned a
function, 0 current matches) are safe. The lead's standing guidance: "skip rather than ship noise."

**How to apply:** the safe extension is a precise `key: (…)=>` / `key: function` shape, never a bare
construct token. Constructs that only violate *inside* a specific config context belong in an
AST/eslint scoped rule, not a file-wide regex — note that and skip. Also: the manifest itself holds
`sample_violation` strings that by construction match a forbid, so `post-edit-laws.py` exempts
`.claude/project.json` from scanning (a category error otherwise — the secret-scan self-tripped on its
own AKIA sample before the exemption). Related: [[eslint-owns-dependency-arrow]].
