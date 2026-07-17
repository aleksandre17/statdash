---
name: self-policing-mandate
description: Owner wants the SYSTEM (not his own eyes) to catch hardcodes/anti-patterns; every stated law must become a machine gate
metadata:
  type: feedback
---

The owner (Aleksandre) has repeatedly been the one to personally discover architectural anti-patterns (e.g. `PAGE_ROOT_TYPE='inner-page'` hardcoding every page as privileged; "Layout" palette group holding only Section; chrome canvas-fidelity hollow rail). He considers *his own discovery of these* the failure mode — the SYSTEM should catch them first.

**Why:** manual discovery does not scale and depends on one person's attention; a law that lives only as prose (or a toothless guard) silently erodes. A green gate that never reached its assertion (false-green) is worse than no gate — it manufactures false confidence.

**How to apply:** When reviewing, for every invariant/law ask "is there a machine gate, and does it actually bite?" Prefer recommending a fitness test / lint rule / hook over a prose fix. Distinguish clearly between (a) instances of an anti-pattern and (b) the missing gate that lets the class recur — the owner triages and routes both, but the gate is the durable fix. Cross-reference stated laws (root `CLAUDE.md` Laws 1-9, module `CLAUDE.md` files) against the actual guards (`.claude/kit/hooks/`, `platform/eslint.config.js` no-restricted-imports, `**/*.fitness.test.*`). Flag any law that is prose-only or only partially/narrowly scoped as UNGUARDED.
