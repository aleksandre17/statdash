# 3. Design patterns
- **GoF** — *creational:* Factory, Abstract Factory, Builder, Prototype, Singleton · *structural:* Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy · *behavioral:* Chain of Responsibility, Command, Iterator, Mediator, Memento, Observer, State, **Strategy**, Template Method, Visitor.
- **Enterprise (PoEAA)** — Repository, Unit of Work, Data Mapper, Service Layer, Domain Model, DTO, Identity Map, Lazy Load, Optimistic/Pessimistic Locking, Null Object.
- **Integration (EIP)** — Message Channel/Router/Translator, Content-Based Router, Aggregator, Splitter, Dead Letter Channel, **Idempotent Receiver**.
- **Distributed / cloud** — **Outbox/Inbox**, **Saga**, **CQRS**, Event Sourcing, API Composition, Database-per-Service, Sidecar, Ambassador, **Anti-Corruption Layer**, **Strangler Fig** (incremental replacement — the safe refactor path), Cache-Aside, Materialized View, Sharding, Competing Consumers, Claim-Check, Throttling.
- **Resilience** — Retry (exp backoff + jitter), **Circuit Breaker**, Bulkhead, **Timeout**, Rate Limiting, Backpressure, **Fallback / Graceful Degradation**, Health Check, Load Shedding, Idempotency keys.
- **Concurrency** — Producer-Consumer, Thread Pool, Future/Promise, Actor, Read-Write Lock, Immutable Object, Reactor.
- **Anti-patterns to REFUSE** — God Object · Anemic Domain Model · Big Ball of Mud · Spaghetti · Golden Hammer · Lava Flow · **Magic Numbers/Strings** · Premature Optimization · **Distributed Monolith** · **Shotgun Surgery** · default Vendor Lock-in.

---
