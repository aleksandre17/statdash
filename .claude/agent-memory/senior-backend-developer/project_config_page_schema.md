---
name: project-config-page-schema
description: config.page is identity-only; config/data_specs live in append-only config.page_version
metadata:
  type: project
---

`config.page` (V3) holds **page identity only**: `id UUID DEFAULT gen_random_uuid()`,
`slug TEXT UNIQUE`, `title JSONB`, `status` (draft|published|archived), `metadata`.
It has **no `roles` column** and **no `config`/`data_specs` columns**.

The editable NodeDef tree + data_specs snapshot live in **`config.page_version`**
(append-only, immutable; `version_number` assigned by a BEFORE INSERT trigger, so
never compute max()+1 app-side). `is_published` flags the live version.

**Why:** Every save = a new immutable version → history / diff / rollback.

**How to apply:** Any page write is two steps in one transaction — upsert identity
by `slug` (the natural idempotency key, since `id` is auto-UUID), then append a
version. For idempotent re-provisioning, append a version ONLY when the config tree
actually changed (canonical/sorted-JSON compare vs the latest version) — otherwise
the append-only table churns on every boot. data_source has NO unique on `name`
(emulate ON CONFLICT with SELECT … FOR UPDATE).
