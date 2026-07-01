---
name: ingestion-architecture
description: Proposed data ingestion architecture to replace seed.ts — Staged Medallion ETL (bronze submission → silver staging+validation → gold publish) over the existing stats cube
metadata:
  type: project
---

Proposed (2026-06) the target data ingestion architecture for the three load layers: facts (stats.observation), classifiers (stats.classifier + LTREE), display overlays (stats.classifier_display). Replaces the manual `apps/api/scripts/seed.ts`.

**Named pattern:** Staged Submission Pipeline = Medallion (bronze/silver/gold) + Pipe-and-Filter + async Submission API (202/job-poll) + approval gate (PUBLISH). Mirrors IMF SDMX Data Sharing lifecycle (submit → validate → promote) and the existing GitOps provisioning loader's discover→parse→upsert shape.

**Why:** seed.ts is not observable, not resumable, no approval, no provenance. The DB already has the gold-layer invariants (V4 dim_key validation trigger, V8 revision audit, V6 dataset_version) — the missing piece is a *staging zone + job lifecycle + provenance* in front of them.

**Key reuse anchors (do not reinvent):** V4 validation trigger = the silver→gold quality gate already in SQL; V8 observation_revision = provenance for free; V6 bump_dataset_version = cache/ETag invalidation already wired into observations.ts; provisioning/{loader,parse,upsert,types}.ts = the exact Pipe-and-Filter + idempotent-upsert + fail-soft pattern to copy for the loader filters.

**How to apply:** when this gets built, build the staging tables + submission/job tables first (new migration V11+), then the loader filters reusing seed-helpers upsert logic, then the Submission API routes, then the curator UI for displays last. Display overlays (curator-authored, Excel/CSV import) are a separate authoring lane from facts/classifiers (registry-pulled). See [[db-layer]].
