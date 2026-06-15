# project_vision

**Platform:** statdash-platform — JSON/config-driven statistical dashboard platform for Georgian national statistics (Geostat / national accounts).

**Owner goal:** A platform where non-technical staff can build statistical dashboards using a drag-and-drop Constructor wizard, publish them, and have the dashboard renderer (geostat app) display them — without writing code.

**Phase 1 (done):** Dashboard renderer — JSON config → rendered dashboard (`platform/apps/geostat`). Static page configs (gdp, trade, etc.).

**Phase 2 (active):** Constructor — visual page builder (panel app) + backend API + database. Constructor output = JSON that the Phase 1 renderer already understands.

**Phase 3 (planned):** Advanced Constructor features — node tree editor, FilterSchema, VarMap, visibleWhen, fieldConfig cascade. Parity with hand-written configs.

**Phase 4 (planned):** Production hardening — auth, RLS, CI/CD, monitoring.

**Quality bar:** Platform-level thinking. Every feature must be reusable, Constructor-ready (no function-in-config), SDMX/OLAP/Grammar-of-Graphics aligned, WCAG 2.1 AA.

**Laws:** see `CLAUDE.md` (9 binding laws). Law 1 (no privileged dims) and Law 2 (declarative config) are the hardest constraints.
