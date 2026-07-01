---
name: feedback-mirror-frontend-contracts
description: DB schema must project existing engine TS contracts verbatim, not invent a parallel relational model
metadata:
  type: feedback
---
When designing DB schema for this platform, **mirror the existing frontend/engine TypeScript contracts** — do not invent a cleaner-looking parallel model.

**Why:** the platform's core invariant (project_vision + CLAUDE.md) is that Constructor writes JSON configs to DB and the engine renders them with zero code change. The DB columns that hold configs (pages.children, datasource auth/classifiers/display, nav items) must round-trip the exact TS shapes (`JSON.parse(JSON.stringify(x)) === x`). A "better" normalization that loses field-name parity breaks the serialize boundary. Concrete examples already settled by the team: Classifier is id-keyed (surrogate) with structural code+parent; DisplayMap is a separate id-keyed overlay; facts carry surrogate ids; nav and pages are independent tables; pages has no nav field.

**How to apply:** for the warehouse/fact-dimension layer, apply full Kimball + SDMX rigor (normalize, constrain, partition) since that is internal storage the engine reaches via a query API. For the CMS/config layer (pages, datasources, nav, node registry), prioritize JSON-safe round-trip fidelity with the TS types over relational purity — store the config tree as JSONB matching `NodeDef[]` / `DatasourceInstanceConfig`. See [[project-db-contracts]] for the doc homes of each contract.
