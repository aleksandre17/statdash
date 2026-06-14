# cms.* — Platform Config Schema

> Multi-tenant CMS: sites, datasources, pages, nav, i18n. Constructor writes; API serves.
> See [`overview.md`](overview.md) for the cross-schema ER map.

---

## 1. Schema namespace

```sql
CREATE SCHEMA cms;
```

---

## 2. Site (tenant)

```sql
CREATE TABLE cms.site (
    id             TEXT PRIMARY KEY,                -- 'geostat','enstat','armstat'
    label          JSONB NOT NULL DEFAULT '{}',
    default_locale TEXT NOT NULL DEFAULT 'ka',
    tokens         JSONB NOT NULL DEFAULT '{}',     -- CSS custom props: {"--color-primary":"#005A9C"}
    chrome         JSONB NOT NULL DEFAULT '{}',     -- ChromeMap
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 3. Datasource instance

Stores `DatasourceInstanceConfig` verbatim (JSON-safe). Constructor writes; engine reads at bootstrap.

```sql
CREATE TABLE cms.datasource_instance (
    site_id       TEXT NOT NULL REFERENCES cms.site(id) ON DELETE CASCADE,
    id            TEXT NOT NULL,                    -- storeKey: 'gdp','accounts','regional'
    plugin        TEXT NOT NULL,                    -- 'sdmx-api'|'rest-json'|'static'|'csv'|'sql'
    url           TEXT,
    structure_url TEXT,
    auth          JSONB NOT NULL DEFAULT '{"type":"none"}',
    classifiers   JSONB,                            -- Tier-1 structural: Record<dim, Classifier>
    display       JSONB,                            -- Tier-1 UI overlay: Record<dim, DisplayMap>
    options       JSONB NOT NULL DEFAULT '{}',      -- plugin-private (engine ignores)
    PRIMARY KEY (site_id, id),
    CONSTRAINT ds_plugin_ck CHECK (plugin IN ('sdmx-api','rest-json','static','csv','sql'))
);

COMMENT ON COLUMN cms.datasource_instance.auth IS
  'Store auth.type + secret_ref ONLY. Resolve real token from Vault/env at bootstrap.
   Never store live bearer tokens — they would leak into page_version snapshots and audit_log diffs (OWASP).';
```

---

## 4. Pages

`children` stores the `NodeDef[]` tree as a single JSONB blob — never shredded into rows.

**Why:** the tree is always read whole (one page = one render), always written whole (Constructor saves the page), and is never queried by inner node attributes at the DB level. Shredding it buys zero query benefit and breaks the `JSON.parse(JSON.stringify(page))` round-trip invariant.

```sql
CREATE TABLE cms.page (
    site_id       TEXT NOT NULL REFERENCES cms.site(id) ON DELETE CASCADE,
    id            TEXT NOT NULL,
    type          TEXT NOT NULL,                    -- 'inner-page'|'tab-page'|'container-page'
    title         JSONB NOT NULL DEFAULT '{}',      -- LocaleString
    store_key     TEXT,
    color         TEXT,
    filter_schema JSONB,                            -- FilterSchemaInput
    children      JSONB NOT NULL DEFAULT '[]',      -- NodeDef[] — the tree, stored whole
    status        TEXT NOT NULL DEFAULT 'published'
        CHECK (status IN ('draft','published','archived')),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by    BIGINT,                           -- REFERENCES iam.app_user(id)
    PRIMARY KEY (site_id, id)
);

-- Page version history (Constructor edits / rollback)
CREATE TABLE cms.page_version (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    site_id     TEXT NOT NULL,
    page_id     TEXT NOT NULL,
    version     INT  NOT NULL,                      -- monotonic per (site, page)
    snapshot    JSONB NOT NULL,                     -- full page row at this version
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  BIGINT,                             -- REFERENCES iam.app_user(id)
    note        TEXT,
    UNIQUE (site_id, page_id, version)
);
-- Constructor "publish" = INSERT version + UPDATE cms.page.
-- Rollback = re-apply any snapshot.
```

---

## 5. Nav items

Independent of pages (`08-site-manifest.md` core insight): a nav item can link to a page, an external URL, or nothing. `page_id` is nullable.

```sql
CREATE TABLE cms.nav_item (
    site_id   TEXT NOT NULL REFERENCES cms.site(id) ON DELETE CASCADE,
    id        BIGINT GENERATED ALWAYS AS IDENTITY,
    label     JSONB NOT NULL DEFAULT '{}',          -- LocaleString
    icon      TEXT,
    path      TEXT NOT NULL,
    page_id   TEXT,                                 -- nullable: external links have no page
    color     TEXT,
    items     JSONB NOT NULL DEFAULT '[]',          -- NavSubItem[]
    hidden    BOOLEAN NOT NULL DEFAULT FALSE,
    ord       INT NOT NULL DEFAULT 0,
    PRIMARY KEY (site_id, id),
    -- same-tenant FK: nav item can only point to a page in the same tenant
    CONSTRAINT nav_page_fk FOREIGN KEY (site_id, page_id)
        REFERENCES cms.page(site_id, id) ON DELETE SET NULL
);
```

---

## 6. i18n slices

```sql
CREATE TABLE cms.i18n_slice (
    site_id  TEXT NOT NULL REFERENCES cms.site(id) ON DELETE CASCADE,
    locale   TEXT NOT NULL,
    ns       TEXT NOT NULL DEFAULT 'common',
    messages JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (site_id, locale, ns)
);
```

---

## 7. Multi-tenant isolation (RLS)

```sql
ALTER TABLE cms.page               ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms.datasource_instance ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms.nav_item           ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms.i18n_slice         ENABLE ROW LEVEL SECURITY;

CREATE POLICY page_tenant ON cms.page
    USING (site_id = current_setting('app.current_site', true));
CREATE POLICY ds_tenant ON cms.datasource_instance
    USING (site_id = current_setting('app.current_site', true));
CREATE POLICY nav_tenant ON cms.nav_item
    USING (site_id = current_setting('app.current_site', true));
CREATE POLICY i18n_tenant ON cms.i18n_slice
    USING (site_id = current_setting('app.current_site', true));

-- API sets per request: SET app.current_site = 'geostat'
-- RLS enforces the rest — a query bug cannot cross tenants.
```

---

## 8. Site manifest assembly — one round-trip

```sql
-- GET /api/site for a tenant = single query assembled by the API layer:
SELECT json_build_object(
  'datasources', (
      SELECT json_agg(d)
        FROM cms.datasource_instance d WHERE d.site_id = $1
  ),
  'pages', (
      SELECT json_object_agg(p.id, to_jsonb(p) - 'site_id')
        FROM cms.page p WHERE p.site_id = $1 AND p.status = 'published'
  ),
  'nav', (
      SELECT json_agg(n ORDER BY n.ord)
        FROM cms.nav_item n WHERE n.site_id = $1 AND NOT n.hidden
  ),
  'tokens', (SELECT tokens FROM cms.site WHERE id = $1),
  'chrome', (SELECT chrome FROM cms.site WHERE id = $1)
);
```

Assembles the full `SiteManifest` JSON in one round-trip — `buildStoreManifest()` (Phase 2) delegates directly to this query.
