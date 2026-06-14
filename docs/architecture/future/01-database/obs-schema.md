# obs.* — Statistical Warehouse Schema

> Kimball star schema + SDMX DSD storage + SNA 2008 alignment. PostgreSQL 16.
> See [`overview.md`](overview.md) for the cross-schema ER map and design rationale.

---

## 1. Schema namespace

```sql
CREATE SCHEMA obs;
```

---

## 2. Conformed dimensions

The engine's `Classifier` = `Record<id, { code, parent?, ...structural }>` and `DisplayMap` = a separate `Record<id, Record<attr, val>>`. **Structural** half is normalized (FK-enforceable, hierarchy-traversable). **Display** half stays JSONB per locale (open UI bag; engine never reads it). This is the `18-classifier-pipe.md` structural/display split in SQL.

```sql
-- A dimension is itself data. 'time','geo','indicator'... are ROWS, never table names (Law 1).
CREATE TABLE obs.dimension (
    dim_key       TEXT PRIMARY KEY,                 -- 'geo','time','indicator','sector','side'
    sdmx_concept  TEXT,                             -- SDMX concept id: REF_AREA, TIME_PERIOD...
    label         TEXT NOT NULL,
    is_time       BOOLEAN NOT NULL DEFAULT FALSE,
    role          TEXT NOT NULL DEFAULT 'dimension'
        CHECK (role IN ('dimension','attribute','measure')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per code, per dimension. surrogate `id` = engine's id-key.
CREATE TABLE obs.dim_member (
    id          BIGINT GENERATED ALWAYS AS IDENTITY,
    dim_key     TEXT   NOT NULL REFERENCES obs.dimension(dim_key) ON DELETE RESTRICT,
    code        TEXT   NOT NULL,                    -- SDMX code: 'P1','B1G','GE-TB','AGRI'
    parent_id   BIGINT REFERENCES obs.dim_member(id) ON DELETE RESTRICT,
    sna_code    TEXT,                               -- SNA 2008 / ESA 2010 alignment (B1G, D1...)
    sort_order  INT    NOT NULL DEFAULT 0,
    valid_from  DATE,                               -- SCD-2 ready (codelist versioning)
    valid_to    DATE,
    is_current  BOOLEAN NOT NULL DEFAULT TRUE,
    attrs       JSONB  NOT NULL DEFAULT '{}',       -- STRUCTURAL bag only (isoCode, nutsLevel...)
    PRIMARY KEY (id),
    CONSTRAINT dim_member_nat_uq UNIQUE (dim_key, code, valid_from)
);

COMMENT ON COLUMN obs.dim_member.id IS
  'Surrogate key. Facts reference THIS, never code — decouples facts from SDMX codelist revisions (Kimball SK rule).';

-- Display overlay: id-keyed, per-locale. Separate so i18n locale add = INSERT rows only.
CREATE TABLE obs.dim_display (
    member_id   BIGINT NOT NULL REFERENCES obs.dim_member(id) ON DELETE CASCADE,
    locale      TEXT   NOT NULL DEFAULT 'ka',
    display     JSONB  NOT NULL DEFAULT '{}',       -- { label, color, fullLabel, sortOrder, ... }
    PRIMARY KEY (member_id, locale)
);

CREATE INDEX dim_member_parent_idx ON obs.dim_member (parent_id);
CREATE INDEX dim_member_dim_idx    ON obs.dim_member (dim_key) WHERE is_current;
```

---

## 3. Fact table — partitioned, hybrid JSONB

```sql
-- Dataset registry (SDMX dataflow header).
CREATE TABLE obs.dataset (
    dataset_code  TEXT PRIMARY KEY,                 -- 'NA_GE','GDP_GE','REGIONAL_GE'
    agency_id     TEXT NOT NULL DEFAULT 'GEOSTAT',
    version       TEXT NOT NULL DEFAULT '1.0',
    dsd_id        TEXT REFERENCES obs.dsd(dsd_id),
    label         JSONB NOT NULL DEFAULT '{}',      -- { ka, en }
    sna_framework TEXT CHECK (sna_framework IN ('SNA2008','ESA2010')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FACT TABLE — Tidy Data: one observation = one row.
-- 6 physical cols (always-present, high-selectivity) + extra_dims JSONB (Law 1: no privileged dims).
CREATE TABLE obs.observation (
    id            BIGINT GENERATED ALWAYS AS IDENTITY,
    dataset_code  TEXT          NOT NULL,
    time_period   INT           NOT NULL,           -- year; quarter → period_type+seq
    geo_id        BIGINT        NOT NULL,           -- surrogate FK → dim_member (dim='geo')
    indicator_id  BIGINT        NOT NULL,           -- surrogate FK → dim_member (dim='indicator')
    obs_value     NUMERIC(20,6),                    -- NULL = suppressed/confidential
    obs_status    CHAR(1)       NOT NULL DEFAULT 'A'
        CHECK (obs_status IN ('A','P','E','R','M','F')),
                                                    -- A=normal P=prelim E=est R=revised M=missing F=final
    unit_mult     SMALLINT      NOT NULL DEFAULT 0, -- SDMX UNIT_MULT: 10^n (3=thousands, 6=millions)
    unit_code     TEXT,                             -- SDMX UNIT_MEASURE: 'GEL','PCT','XDC'
    is_carry_fwd  SMALLINT      NOT NULL DEFAULT 0  -- SNA dedup: backend-computed, NOT frontend
        CHECK (is_carry_fwd IN (0,1)),
    extra_dims    JSONB         NOT NULL DEFAULT '{}', -- {"sector":42,"side":"R"}
    vintage_id    BIGINT,                           -- → obs.dataset_vintage(id)
    loaded_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    PRIMARY KEY (id, dataset_code, time_period)     -- PK must include partition keys
) PARTITION BY LIST (dataset_code);

-- geo + indicator are physical FKs (present in every dataset, highest-selectivity predicates).
-- All other dimensions live in extra_dims (new dim = zero DDL).
ALTER TABLE obs.observation
  ADD CONSTRAINT obs_geo_fk       FOREIGN KEY (geo_id)       REFERENCES obs.dim_member(id),
  ADD CONSTRAINT obs_indicator_fk FOREIGN KEY (indicator_id) REFERENCES obs.dim_member(id),
  ADD CONSTRAINT obs_dataset_fk   FOREIGN KEY (dataset_code) REFERENCES obs.dataset(dataset_code);
```

**Partitioning.** LIST by `dataset_code` — each dataset = one partition (atomic drop/reload). RANGE sub-partition by `time_period` for large datasets:

```sql
CREATE TABLE obs.observation_na PARTITION OF obs.observation
    FOR VALUES IN ('NA_GE') PARTITION BY RANGE (time_period);
CREATE TABLE obs.observation_na_2010s PARTITION OF obs.observation_na
    FOR VALUES FROM (2010) TO (2020);
CREATE TABLE obs.observation_na_2020s PARTITION OF obs.observation_na
    FOR VALUES FROM (2020) TO (2030);
CREATE TABLE obs.observation_gdp     PARTITION OF obs.observation FOR VALUES IN ('GDP_GE');
CREATE TABLE obs.observation_default PARTITION OF obs.observation DEFAULT;
```

---

## 4. Indexing strategy (cardinality-driven)

```sql
-- Primary access path: dataset + indicator + time (partition pruning + next two most selective)
CREATE INDEX obs_idx_main ON obs.observation (dataset_code, indicator_id, time_period)
    INCLUDE (obs_value, geo_id, obs_status);        -- covering → index-only scans on hot query

-- Geo drill-down (regional comparison page):
CREATE INDEX obs_idx_geo ON obs.observation (dataset_code, geo_id, time_period);

-- Open-dimension predicates (ObsQuery.dims → JSONB containment):
CREATE INDEX obs_idx_extra_gin ON obs.observation USING GIN (extra_dims jsonb_path_ops);

-- "finals only" — most common read path:
CREATE INDEX obs_idx_final ON obs.observation (dataset_code, time_period)
    WHERE obs_status IN ('A','F') AND is_carry_fwd = 0;
```

---

## 5. DSD storage — SDMX Data Structure Definition

```sql
CREATE TABLE obs.dsd (
    dsd_id    TEXT PRIMARY KEY,                     -- 'NA_GE_DSD'
    agency_id TEXT NOT NULL DEFAULT 'GEOSTAT',
    version   TEXT NOT NULL DEFAULT '1.0',
    label     JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE obs.dsd_component (
    dsd_id       TEXT NOT NULL REFERENCES obs.dsd(dsd_id) ON DELETE CASCADE,
    dim_key      TEXT NOT NULL REFERENCES obs.dimension(dim_key),
    position     INT  NOT NULL,                     -- SDMX dimension order
    role         TEXT NOT NULL CHECK (role IN ('dimension','timeDimension','attribute','measure')),
    is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    codelist_id  TEXT,
    PRIMARY KEY (dsd_id, dim_key)
);
```

---

## 6. Vintage FSM — preliminary → revised → final

```sql
CREATE TABLE obs.dataset_vintage (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dataset_code  TEXT NOT NULL REFERENCES obs.dataset(dataset_code),
    label         TEXT NOT NULL,
    release_date  DATE NOT NULL,
    lifecycle     TEXT NOT NULL DEFAULT 'preliminary'
        CHECK (lifecycle IN ('preliminary','revised','final')),
    is_current    BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (dataset_code, label)
);

-- Guard: only forward transitions allowed. Illegal state = unrepresentable.
CREATE FUNCTION obs.guard_vintage_transition() RETURNS trigger AS $$
BEGIN
  IF (OLD.lifecycle, NEW.lifecycle) IN
     (('final','revised'),('final','preliminary'),('revised','preliminary')) THEN
    RAISE EXCEPTION 'illegal vintage transition % -> %', OLD.lifecycle, NEW.lifecycle;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER vintage_fsm BEFORE UPDATE OF lifecycle ON obs.dataset_vintage
  FOR EACH ROW EXECUTE FUNCTION obs.guard_vintage_transition();
```

---

## 7. SDMX-JSON serializer — fact table → wire format

Returns the `ApiResponse { meta, structure, data }` envelope from `25-datasource-system.md`. A Phase-2 SDMX datasource can be served from Postgres with no application-layer reshaping.

```sql
CREATE FUNCTION obs.to_sdmx_json(
    p_dataset  TEXT,
    p_from     INT DEFAULT NULL,
    p_to       INT DEFAULT NULL,
    p_locale   TEXT DEFAULT 'ka'
) RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'meta', jsonb_build_object(
       'schema',   'SDMX-JSON:1.0',
       'id',       p_dataset,
       'prepared', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
       'source',   'Geostat'),
    'structure', jsonb_build_object(
       'classifiers', obs.classifiers_for(p_dataset),
       'display',     obs.display_for(p_dataset, p_locale)
    ),
    'data', jsonb_build_object('observations',
       COALESCE(jsonb_agg(jsonb_build_object(
          'time',   o.time_period,
          'geo',    g.code,
          'value',  o.obs_value,
          'status', o.obs_status,
          'dims',   jsonb_build_object('indicator', i.code) || o.extra_dims
       )), '[]'::jsonb))
  )
  FROM obs.observation o
  JOIN obs.dim_member g ON g.id = o.geo_id
  JOIN obs.dim_member i ON i.id = o.indicator_id
  WHERE o.dataset_code = p_dataset
    AND (p_from IS NULL OR o.time_period >= p_from)
    AND (p_to   IS NULL OR o.time_period <= p_to  )
    AND o.is_carry_fwd = 0;
$$;
```

---

## 8. Ingestion rules (binding on ETL, not schema)

- **Batch insert:** ETL loads with `COPY` or multi-row `INSERT … SELECT unnest(...)`. Never per-row.
- **Upsert idempotency:**
  ```sql
  INSERT INTO obs.dim_member (dim_key, code, parent_id, sna_code, attrs) VALUES (...)
  ON CONFLICT (dim_key, code, valid_from) DO UPDATE
    SET attrs = EXCLUDED.attrs, sna_code = EXCLUDED.sna_code;
  ```
- **Full reload:** `TRUNCATE obs.observation_na` + `COPY` (atomic per partition).
