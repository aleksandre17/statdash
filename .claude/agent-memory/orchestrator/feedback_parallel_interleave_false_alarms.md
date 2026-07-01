---
name: parallel-interleave-false-alarms
description: When running parallel agents, a cross-agent flag about another agent's file is often a mid-edit transient — verify the converged tree before acting
metadata:
  type: feedback
---

When N agents run in parallel and one reports a typecheck/build error in ANOTHER agent's file, treat it as a likely **mid-edit transient**, not a real defect.

**Why:** This has recurred repeatedly. Examples: a B agent flagged a TS error in A's TemplateGallery (A's mid-edit state; final typecheck clean); in the finish-everything wave, the check-laws agent AND the geostat agent BOTH independently flagged `href-registrations.ts:211` (`exactOptionalPropertyTypes` auth-header) while the D-HREF agent was still editing that file — the converged tree typechecked clean (exit 0, 0 errors). A concurrent agent sees a snapshot of a file another agent hasn't finished writing.

**How to apply:** Don't reflexively dispatch a "fix" agent on a cross-agent flag — that risks editing already-clean code or colliding. Instead: (1) let all parallel agents finish, (2) run the full green-gate on the CONVERGED tree yourself (`pnpm typecheck` for the fast signal, then lint/build/test), (3) act only on what's red in the converged state. A convergent flag from two agents *feels* authoritative but can still be a shared view of the same mid-edit file. Verify, then decide. Relatedly: always run the converged green-gate AFTER a parallel wave and BEFORE committing — and don't start the next wave's edits while a test run is in flight (it'll catch mid-edit state). See [[verify-board-empirically]].
