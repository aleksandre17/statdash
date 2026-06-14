# meta.* + iam.* — Constructor Registry, Users, Roles, Audit

> Constructor introspection (meta), IAM, audit log.
> See [`overview.md`](overview.md) for the cross-schema ER map.

---

## 1. Schema namespaces

```sql
CREATE SCHEMA meta;
CREATE SCHEMA iam;
```

---

## 2. Constructor metadata (meta.*)

### 2.1 Node type registry

`NodeRegistryMeta` from `15-constructor.md §1` — the Constructor palette source of truth.

```sql
CREATE TABLE meta.node_type (
    type      TEXT PRIMARY KEY,                     -- 'section','chart','kpi-strip'
    label     JSONB NOT NULL DEFAULT '{}',          -- LocaleString
    icon      TEXT,
    category  TEXT,                                 -- 'layout'|'data'|'page'
    variants  JSONB NOT NULL DEFAULT '[]',          -- string[] CSS modifier hints
    schema    JSONB,                                -- JSON Schema → Constructor property form
    preview   TEXT                                  -- static thumbnail path (palette tile)
);
```

### 2.2 Transform registry

`engine.listTransforms()` from `15-constructor.md §2`.

```sql
CREATE TABLE meta.transform (
    name        TEXT PRIMARY KEY,                   -- 'fromSDMX','raw','fromCSV'
    description TEXT
);
```

### 2.3 Data catalog (VIEW)

`GET /api/catalog → DatasetEntry[]`. A VIEW, not a table — derives from the DSD chain so it can never drift from structural metadata.

```sql
CREATE VIEW meta.catalog AS
SELECT
  d.dataset_code                      AS id,
  d.label,
  ds.url                              AS href,
  'fromSDMX'::text                    AS transform,
  (SELECT json_agg(json_build_object(
      'key',    c.dim_key,
      'label',  dm.label,
      'values', (
          SELECT json_agg(json_build_object(
              'code',  m.code,
              'label', disp.display->>'label'))
          FROM obs.dim_member m
          LEFT JOIN obs.dim_display disp
                 ON disp.member_id = m.id AND disp.locale = 'ka'
          WHERE m.dim_key = c.dim_key AND m.is_current
      )))
   FROM obs.dsd_component c
   JOIN obs.dimension dm ON dm.dim_key = c.dim_key
   WHERE c.dsd_id = d.dsd_id AND c.role = 'dimension') AS dimensions
FROM obs.dataset d
LEFT JOIN cms.datasource_instance ds ON ds.id = d.dataset_code;
```

---

## 3. IAM (iam.*)

### 3.1 Users

No password column — federate to OIDC. Store only the OIDC subject claim if needed.

```sql
CREATE TABLE iam.app_user (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    display_name  TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.2 Roles and permissions

```sql
CREATE TABLE iam.role (
    id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE                       -- 'admin','editor','viewer'
);

CREATE TABLE iam.permission (
    id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE                       -- 'page.write','datasource.write','data.publish'
);

CREATE TABLE iam.role_permission (
    role_id       BIGINT REFERENCES iam.role(id)       ON DELETE CASCADE,
    permission_id BIGINT REFERENCES iam.permission(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Roles scoped PER TENANT (a user may edit Geostat but only view ENstat):
CREATE TABLE iam.user_role (
    user_id BIGINT REFERENCES iam.app_user(id) ON DELETE CASCADE,
    role_id BIGINT REFERENCES iam.role(id)     ON DELETE CASCADE,
    site_id TEXT   REFERENCES cms.site(id)     ON DELETE CASCADE, -- NULL = global
    PRIMARY KEY (user_id, role_id, site_id)
);
```

---

## 4. Audit log (append-only)

```sql
CREATE TABLE iam.audit_log (
    id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id  BIGINT REFERENCES iam.app_user(id),
    action    TEXT NOT NULL,                        -- 'page.publish','datasource.update'
    entity    TEXT NOT NULL,                        -- 'cms.page','obs.dataset_vintage'
    entity_id TEXT NOT NULL,
    site_id   TEXT,
    diff      JSONB,                                -- {before, after} or JSON patch
    at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_entity_idx ON iam.audit_log (entity, entity_id, at DESC);
-- Append-only enforced by trigger or: REVOKE UPDATE, DELETE ON iam.audit_log FROM app_role;
```

---

## 5. Cross-schema FK wiring

These FK additions happen after all schemas exist:

```sql
-- cms.page.updated_by → iam
ALTER TABLE cms.page
    ADD CONSTRAINT page_updated_by_fk FOREIGN KEY (updated_by) REFERENCES iam.app_user(id);

-- cms.page_version.created_by → iam
ALTER TABLE cms.page_version
    ADD CONSTRAINT pv_created_by_fk FOREIGN KEY (created_by) REFERENCES iam.app_user(id);

-- obs.observation.vintage_id → obs.dataset_vintage
ALTER TABLE obs.observation
    ADD CONSTRAINT obs_vintage_fk FOREIGN KEY (vintage_id) REFERENCES obs.dataset_vintage(id);
```

---

## 6. Bootstrap seed data

Minimum viable seed for a Geostat instance:

```sql
INSERT INTO cms.site (id, label, default_locale)
VALUES ('geostat', '{"ka":"საქართველოს სტატისტიკა","en":"Statistics of Georgia"}', 'ka');

INSERT INTO iam.role (name) VALUES ('admin'), ('editor'), ('viewer');
INSERT INTO iam.permission (name)
VALUES ('page.write'), ('datasource.write'), ('data.publish'), ('user.manage');

-- admin role gets all permissions:
INSERT INTO iam.role_permission (role_id, permission_id)
SELECT r.id, p.id FROM iam.role r, iam.permission p WHERE r.name = 'admin';

-- editor role gets content permissions:
INSERT INTO iam.role_permission (role_id, permission_id)
SELECT r.id, p.id FROM iam.role r, iam.permission p
WHERE r.name = 'editor' AND p.name IN ('page.write','datasource.write');

INSERT INTO obs.dimension (dim_key, sdmx_concept, label, role) VALUES
  ('time',      'TIME_PERIOD', 'Time',      'timeDimension'),
  ('geo',       'REF_AREA',    'Geography', 'dimension'),
  ('indicator', 'INDICATOR',   'Indicator', 'dimension'),
  ('sector',    'SECTOR',      'Sector',    'dimension'),
  ('side',      'SIDE',        'Side',      'dimension');

INSERT INTO meta.transform (name, description) VALUES
  ('fromSDMX', 'SDMX-JSON ApiResponse → DataRow[]'),
  ('raw',      'raw JSON array passthrough'),
  ('fromCSV',  'CSV text → DataRow[]');
```
