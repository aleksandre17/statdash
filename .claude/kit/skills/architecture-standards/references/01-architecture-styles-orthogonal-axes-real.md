# 1. Architecture styles (orthogonal axes — real systems combine several)
**Deployment topology** — Monolithic · **Modular monolith** (pragmatic default) · Layered (N-tier) · Microkernel/Plugin · Service-based · SOA · Microservices · Event-Driven · Space-based · Cell-based · Micro-frontends.
**Internal structure** — Layered · **Hexagonal (Ports & Adapters)** · Onion · **Clean** · Vertical slice · Component-based.
**Communication** — sync: Client-Server, RPC, REST/GraphQL/gRPC · async: Pub/Sub, EDA (broker/mediator), Event Sourcing, CQRS, Streaming, Saga (orchestration/choreography) · shared: Data-centric, Blackboard.
**Data architecture** — Lambda · Kappa · Medallion (bronze/silver/gold) · Data Mesh · Polyglot persistence (store per workload).
**Integration** — API Gateway · **Backend-for-Frontend (BFF)** · Service Mesh · ESB · **Pipe-and-Filter** · Blackboard.
**UI** — MVC · MVP · MVVM · Flux/Redux · Server-Driven UI (SDUI) · Micro-frontends.
**Hosting** — On-prem · Cloud-native (containers + orchestration) · Serverless/FaaS · 12-factor/PaaS.

---
