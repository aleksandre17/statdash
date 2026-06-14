# Engineering Laws — geostat-chat-ai

> **Canonical law set: `CLAUDE.md` §Non-negotiable laws (11, unioned).** This file no longer restates them — it points there and adds only the working-session *execution* rules below. (Historic source `.cursor/rules/` superseded by CLAUDE.md.)

## Strict Laws (never violate)

→ **See `CLAUDE.md` §Non-negotiable laws.** All 11 (No-hardcode · No-domain-literals-in-libs · Zero-gap · No-degradation · Clean-Arch · Plan-first · One-body · Fix-first · Max-capability · Kit-upstream · Green-after-layer) live there as the single source. Do not duplicate here.

## Clean Architecture (strict)

- **Application layer**: orchestration + domain port interfaces only.
  Never imports infrastructure concrete types (`JdbcX`, `QdrantX`, `GeminiX`).
- **Infrastructure layer**: adapters + manifest-loaded config only.
- **Package structure**: logic-based — `crawl/job/`, `crawl/runner/`, `parse/`, `enrichment/`, etc.
  No flat piles.

## Approved Stack

| Concern | Technology | Notes |
|---------|-----------|-------|
| Crawl | crawler4j + Postgres frontier | not hand-rolled |
| Parse | Jsoup | |
| Migrations | Flyway | ingestion-service owns schema |
| Vectors | Qdrant gRPC | named vectors: body / title / summary |
| Async (P5) | RabbitMQ Spring AMQP | optional, Phase 5 |
| LLM | Gemini 2.5-flash-lite | generation + enrichment |
| Embedding | text-embedding-004 | |
| Ops | geostat.ops.json manifest + geostat-kit submodule | |

## Execution Rules

- Minimize diff — smallest correct change; match existing naming and patterns
- No commit unless explicitly asked by owner
- Respond in Georgian when the owner writes in Georgian
- Before implementing: flag law violations; never silently work around them
- Verify: run checks after changes; state what passed and what was skipped