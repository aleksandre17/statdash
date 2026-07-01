---
name: classifier-code-path-adr
description: Pointer to ADR-0023-classifier-code-path.md — classifier hierarchy moves surrogate-id-chain → code-chain LTREE over the stable (dim_code, code) business key. Strangler-Fig V23 EXPAND + V24 CONTRACT. Status: Accepted (design).
metadata:
  type: project
---

**Decision record migrated to `docs/architecture/decisions/ADR-0023-classifier-code-path.md`** (SSOT reorg).

ADR-0023: the `stats.classifier` hierarchy edge + LTREE path move from the churning surrogate `id` to the stable `(dim_code, code)` business key (`parent_code` + `code_path`), so a revision never re-points children (Step 3/3b vanish) and as-of tree = a validity-window filter. Rollout = V23 EXPAND + V24 CONTRACT (NOT three; V22 already ships the is_current fix). Status: Accepted (design).

Full context, decision, ≥2 rejected alternatives, consequences, and the verbatim design record now live in the ADR. This memory is only the pointer.

Related: [[project_db_layer]] [[project_ingestion_architecture]] [[project_i18n_db]]
