# Provisioning (file-based config / GitOps) — P2-5

Every `*.json`, `*.yaml`, and `*.yml` file in this directory is read **on API boot**
and **upserted** into the `config.*` tables. Config-in-files = reproducible deploys:
this directory is the source of truth, every boot re-applies it, and a fresh
environment converges on exactly what is committed here.

The loader is **idempotent** (safe to re-run on every boot) and **never destructive**
(it only ever creates/updates; a resource removed from these files is left in the DB
and retired through the CRUD API / lifecycle, not by file omission).

## Configuration

| Env var                | Default          | Purpose                                              |
| ---------------------- | ---------------- | ---------------------------------------------------- |
| `PROVISIONING_DIR`     | `./provisioning` | Directory scanned on boot.                           |
| `PROVISIONING_DRY_RUN` | `false`          | `true` → log the planned upserts, write nothing (CI).|

A missing directory is a no-op (provisioning is optional for boot). A single
malformed file is logged and skipped; the rest still apply.

## Two file formats

### 1. Direct page config

A file that **is** a page config (a `NodePageConfig`). The loader derives the page
identity from `slug` → `id` → `path`, and stores the whole object as the config tree.
See [`example.page.json`](./example.page.json).

```json
{
  "id": "gdp",
  "type": "inner-page",
  "path": "/gdp",
  "title": { "ka": "მშპ", "en": "GDP" },
  "children": [ /* ... NodeDef tree ... */ ]
}
```

### 2. Manifest (multi-resource)

A file with `"version": 1` at the root declares any mix of pages, nav items, and
data sources. Detection: **`version: 1` present → manifest; otherwise → direct page
config.**

```yaml
version: 1
pages:
  - slug: gdp
    title: { ka: "მშპ", en: "GDP" }
    status: published          # draft | published | archived (default: published)
    config:                    # the NodePageConfig JSON
      type: inner-page
      path: /gdp
      children: []
    dataSpecs: []              # optional NamedDataSpec[] snapshot

navItems:                      # top-level nav only (nested trees → CRUD API)
  - label: { ka: "მშპ", en: "GDP" }
    pageSlug: gdp              # internal target (resolved by slug)
    ord: 0
  - label: { en: "Docs" }
    href: https://example.org  # external link (mutually exclusive with pageSlug)

dataSources:
  - name: geostat-sdmx
    type: sdmx-json            # sdmx-json | rest | static
    url: https://example.org/sdmx  # OMIT for single-origin (=> NULL, see below)
    status: connected          # idle | connected | error | pending (default: connected)
    config: {}
```

**`url` — omit it for the single-origin reverse-proxy deploy.** The SPAs call the api
same-origin via a relative `/api`; the client uses a NULL `url` to fall back to its own
relative base. A non-null `url` is only for a genuinely cross-origin / external source —
**never** `http://localhost:3001`. **`status` defaults to `connected`** (a declared
source is meant to be live, mirroring a page defaulting to `published`): the public
`GET /api/data-sources` filters `status='connected'`, so an unset/`idle` source would
not surface. The DB column default (`idle`) is deliberately not relied on.

## Idempotency keys

| Resource    | Key (ON CONFLICT)            | Notes                                                              |
| ----------- | ---------------------------- | ----------------------------------------------------------------- |
| page        | `slug` (UNIQUE)              | A new immutable `page_version` is appended **only** when the config tree changed. |
| dataSource  | `name`                       | No DB UNIQUE on name; emulated with `SELECT … FOR UPDATE`. An unchanged row (type/url/config/status) short-circuits to `unchanged`. |
| navItem     | localized label (top-level)  | Nested nav trees are authored via the CRUD API, not provisioned.  |

## Round-trip / export

`GET /api/admin/export/provisioning` (admin-guarded) emits the current config as a
valid manifest. Workflow: **export → commit to git → redeploy.** Re-importing an
unchanged export is a no-op.
