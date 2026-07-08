---
name: eslint-owns-dependency-arrow
description: eslint no-restricted-imports is the SOLE source of truth for the dependency arrow; never mirror or extend arrow edges into kit manifest law_patterns
metadata:
  type: feedback
---

eslint `no-restricted-imports` (`platform/eslint.config.js`) is the single source of truth for the
dependency arrow (`contracts ← expr ← core ← charts ← react ← plugins ← apps`) and all import-shaped
boundaries (contracts purity, xlsx ACL, panel reach-in). New arrow edges are added to eslint ONLY.

The two regex `law_patterns` in `.claude/project.json` that mirror arrow edges (`Arch-engine-no-react`,
`Arch-react-agnostic`) are deliberately **non-authoritative fast pre-lint tripwires** — kept for
edit-time ergonomics, labelled as such in their `msg`. They are strictly weaker than eslint (they only
catch fully-qualified import specifiers, not relative ones).

**Why:** two enforcers for one rule invites drift and false confidence (architect policy, ADR-0033).
`post-edit-laws.py` owns only what the import graph *cannot* express — content/purity invariants
(privileged-dims, declarative-DataSpec, locale-agnostic literals, secret shapes).

**How to apply:** when tempted to "harden the arrow" by adding more `Arch-*` regex laws to the manifest,
DON'T — add the edge to eslint instead. Do not extend the two existing tripwires to more edges. See
[[measure-fp-before-blocking-law]] for the general rule on blocking regex laws.
