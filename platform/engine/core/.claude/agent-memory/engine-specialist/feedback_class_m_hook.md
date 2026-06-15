---
name: class-m-hook-protocol
description: When the pre-tool hook fires on a public API edit, run Task-degradation risk 09B before proceeding — reversibility, blast radius, rollback cost, standard precedent
metadata:
  type: feedback
---

When the PreToolUse:Edit hook fires with "Class-M + IRREVERSIBLE: public package API change", stop and run the Task-degradation risk assessment (09 B) explicitly in the response before making any further edits.

The assessment covers: reversibility, blast radius, rollback cost, standard precedent, Constructor-readiness.

**Why:** Public API changes to `@geostat/engine` are cross-layer contracts. Downstream consumers (react layer, plugins, app) depend on them. The hook is a mandatory gate — skipping it or deferring it to after the edit defeats the purpose.

**How to apply:** Write the 09 B assessment as a named section in the response, then proceed only if the risk profile is acceptable (additive-only, established-pattern, trivially reversible). If not, escalate to Opus before editing.

Validated approach: structural repetition of an Opus-blessed seam (e.g. `setSpecResolveObserver`) does not require re-escalation. New architectural patterns do.
