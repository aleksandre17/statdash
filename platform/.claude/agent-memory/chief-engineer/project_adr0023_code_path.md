---
name: adr0023-code-path
description: ADR-0023 classifier hierarchy moved from surrogate-id chain to stable (dim_code, code) code-chain (V23 expand / V24 contract); the version-vs-identity SCD-2 cluster fix
metadata:
  type: project
---

ADR-0023 closes the "version vs identity" SCD-2 cluster: the classifier hierarchy EDGE and its materialized LTREE path moved off the churning surrogate `parent_id`/`path` onto the stable business key `parent_code` + `code_path` (sanitised code chain). V23 = expand (two-way, additive, parity assertion), V24 = contract (one-way, drops parent_id/path, re-points the V18 cycle guard to parent_code first).

**Why:** SCD-2 (V6/V18) mints a new surrogate id per revision, so an id-chain path could not honour both identity fidelity and temporal fidelity — the old upsert.ts re-pointed children + rebuilt subtree paths every revision, writing temporally-incoherent historical edges. Codes are stable across revisions (SDMX identifies by code, Law 1), so a code-chain path never moves on a revision. Defect is gone by construction.

**How to apply:** Cluster is CLOSED and correct — temporal incoherence is structurally impossible, upsert.ts Step 3/3b deletion is safe, publishClassifiers topological loop is arbitrary-depth correct, as-of read is a pure validity-window filter. ONE cosmetic remaining item: V24 line 145 trigger-ordering COMMENT is factually wrong — claims trg_classifier_no_cycle "sorts before trg_classifier_code_path" but Postgres fires same-timing BEFORE-row triggers alphabetically and `code_path` < `no_cycle`, so code_path fires FIRST. Behaviorally benign (both raise + abort the txn; a self-edge/cycle still rejects, just possibly via the path lookup's own logic), but the stated guarantee "cycle caught with a clear message before code_path materialization" does not hold. Sanitiser collision caveat (code_to_ltree_label many-to-one) is genuinely benign for ancestry traversal but is NOT collision-free; a hex/base32 encoding would be strictly stronger if identity-grade code_path is ever needed. See [[project_db_schema]].
