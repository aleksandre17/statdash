---
name: project-time-period-date-ssot
description: SDMX period↔date conversion lives only in stats.parse_time_period (start) + parse_time_period_end (end); routes must not do date math
metadata:
  type: project
---

SDMX TIME_PERIOD ↔ DATE conversion is centralized in two SQL functions, and is the SSOT for period boundary math:
- `stats.parse_time_period(TEXT) RETURNS DATE` — START of period (V4, widened to full A/S/Q/W/M/D in V9). Also backs `observation.time_period_date` GENERATED STORED column.
- `stats.parse_time_period_end(TEXT) RETURNS DATE` — inclusive END / last day of period (V16). Defined as start(p) + one period - 1 day.

The canonical SDMX format regex (accept-set, identical across the V9 CHECK `obs_time_period_fmt_chk`, both parsers, and the API Zod schema): `^\d{4}(-S[12]|-Q[1-4]|-W\d{2}|-\d{2}(-\d{2})?)?$`

**Why:** the observations route used to hardcode annual boundaries (`${from}-01-01`/`${to}-12-31`), breaking for quarterly/monthly/SDMX-string ranges. Fixed to pass raw period text to the SQL functions.

**How to apply:** any new code doing time_period range filtering must call these functions (pass raw SDMX period text), never compute dates in the app layer. New frequencies = update both parsers + the regex in lockstep. See [[project_sql_migrations_location]].
