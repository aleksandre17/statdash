---
name: project-featured-manifest
description: DATA/canonical/FEATURED.json — governed featured-metrics collection driving the landing-page slider (AR-40), authored via yellow-cell signal
metadata:
  type: project
---

`DATA/canonical/FEATURED.json` is a governed **featured-metrics collection** (AR-40's first consumer: the landing-page "featured headline statistics" slider). Introduced on branch `feat/data-refresh-featured`.

Shape: `{schemaVersion, kind:"featured-metrics", source, featured:[…]}`. Each entry = `{id, dataset, coordinate:{full dimKey + time}, value, unit, obsStatus, label:{ka,en}, provenance:{workbook,sheet,valueCell,labelCell,fill}, order}`. The `coordinate` is the full dimensional address — it resolves to exactly ONE observation in `DATA/canonical/*.xlsx` (verify diff=0 when regenerating).

**Why:** The authoring signal is declarative — a **yellow cell fill (ARGB FFFFFF00)** in the GeoStat source workbooks marks a headline datum. NOTE: the fill lives only in the working-tree/highlighted source copies; the committed source copies may lack it (values are identical — highlight is style-only). Value/label/obsStatus are DERIVED from the canonical SSOT, never hand-copied.

**How to apply:** When the slider or a new consumer reads featured metrics, treat FEATURED.json as the SSOT list; render value+unit+bilingual label and badge `obsStatus:"P"` as provisional (Law 9). To regenerate, re-scan yellow fills in the source workbooks and re-resolve each coordinate against the canonical. See [[project_regional_gva_2010_2015_revision]], [[project_db_state]].
