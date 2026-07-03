---
name: landing-slider-featured
description: The main/landing page slider is BUILT FROM the yellow-highlighted cells in the source DATA xlsx — yellow is an authoring-only "featured" signal, never a UI color. Deflator belongs to GDP.
metadata:
  type: project
---

The landing (main) page **slider** = "featured headline statistics" — it is BUILT FROM the data marked **yellow** in the owner's source Excel files (`DATA/*.xlsx`).

**Why:** the owner (a statistician) marks the editorial headline figures yellow in the source (GNI/GDI/Gross-Saving/Net-lending from National Accounts; the latest-year GDP headline figures; the top featured regions). That yellow highlight is the **declarative authoring signal** for what appears on the slider — reference-NSO "headline indicators / key figures" pattern (ONS/Eurostat/OECD/IMF).

**How to apply:**
- Yellow is **authoring-only** — NEVER rendered as a UI color. The slider is BUILT FROM that data, not styled yellow. ("არ ვაბამ რომ ყვითლად დარჩეს.")
- The canonical-ingest pipeline extracts the yellow cells → a machine-readable **featured** manifest → tags them `featured` in the **semantic layer** ([[maximal-adoption-doctrine]] AR-40's first real consumer) → the landing-slider config reads featured metrics declaratively → renders the carousel. Owner's words: *"ეს ინფო სლაიდერზე ჩვენი semantic layer-ით და config data pipeline-ით უნდა გააკეთო."* No hardcode — mark a cell yellow → it appears on the slider.
- **GDP deflator belongs to the GDP dataset** (`GDP_ANNUAL`, as an indicator/measure) — NOT a separate canonical dataset. ("მშპ დეფლატორი გააერთიანე GDP-სთან.")
