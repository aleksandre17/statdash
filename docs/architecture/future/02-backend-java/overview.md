# Backend — Java

> REST API. SDMX data serving. site-manifest. catalog. Constructor persistence.
> გზადაგზა ივსება.

---

## ცნობილი endpoints (architecture-დან)

```
GET /api/site-manifest  → { pages, nav }
GET /api/catalog        → DatasetEntry[]
GET /api/sdmx/{id}      → SDMX-JSON (fromSDMX() boundary)
POST /api/pages         → Constructor page create
POST /api/nav           → Constructor nav create
```

---

## ცნობილი პრინციპები

- fromSDMX() boundary = ერთადერთი SDMX → Observation[] ადაპტერი
- Backend Phase 2: isCarryForward computed server-side
- Backend Phase 2: CODE_MAP canonical codes (no frontend mapping)
- Catalog API: pre-processed DSD — frontend never fetches raw SDMX

---

## TODO — გზადაგზა შეავსე

- [ ] Spring Boot vs Quarkus decision
- [ ] SDMX-JSON parsing layer
- [ ] Authentication / authorization
- [ ] Constructor API endpoints full spec
- [ ] Caching strategy (SDMX data)
