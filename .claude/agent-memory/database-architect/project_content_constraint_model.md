---
name: project-content-constraint-model
description: V26 ContentConstraint cube-region model — predicate rows, AND-conjoined conditions, allowed=table / actual=view
metadata:
  type: project
---
V26 (ADR-0027, SDMX-P0-1) added the legal cube region — which dimension-VALUE COMBINATIONS are allowed (the V4 trigger only validates each value in isolation).

**Model = predicate rows, NOT enumerated tuples.** `stats.content_constraint` (header, per dataset+role) + `stats.content_constraint_member` rows: `(dim_code, code, cond_dim_code, cond_code)`. Unconditional row (cond NULL) = an allowed-set member for a dim (a dim with no rows is unconstrained). Conditional row = "dim_code may be `code` ONLY WHEN cond_dim_code = cond_code". The real case it exists for: ACCOUNTS_SEQUENCE account **B9 (net lending/borrowing) is legal only on side U** — modeled as ONE row `(account, B9, side, U)`. Rejected enumerated-tuple table (combinatorial blow-up) and pure-independent-sets (can't express cross-dim dependency).

**Non-obvious decision — conjunction:** multiple conditional rows on the SAME (dim_code, code) are **AND-conjoined** (every condition must hold). Fail-safe/restrictive; covers single-condition exactly. True OR would need a future nullable rule_group_id (additive escalation, YAGNI).
**Why:** the single-`cond`-column shape is otherwise ambiguous for multi-condition; AND is the safe defined reading.

**role split (SSOT):** `allowed` = authored (table, role CHECK pins the table to 'allowed'). `actual` = DERIVED VIEW `stats.cube_actual_region` over stats.observation (cannot drift). Cube-profile endpoint joins view + `stats.dim_key_in_allowed_region()` to classify has-data / empty-by-design / missing.

**Enforcement is SILVER, not a trigger.** `stats.dim_key_in_allowed_region(TEXT,JSONB)` is the DB-side SSOT predicate; `platform/apps/api/src/ingest/region.ts` is its in-memory batch twin used by validate.ts (emits ILLEGAL_COMBINATION). The fitness test asserts the corpus against the DB helper so silver/gold can't diverge. No hot-path trigger on the observation hypertable (consistent with V25/V8).

**How to apply:** if extending the region model, keep region.ts and the SQL helper in lockstep (they're deliberate twins). New conditional semantics = update BOTH + the fitness test. See `[[project-db-state]]` and the full architect ADR project_content_constraint_adr.md.
