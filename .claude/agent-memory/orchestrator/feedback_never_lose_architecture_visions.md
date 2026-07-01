---
name: never-lose-architecture-visions
description: The owner's high-concept architectures/visions kept getting LOST (raised in chat, designed, then forgotten when we moved on). The lead MUST capture every architectural vision durably in the version-controlled Architecture Registry — nothing lives only in a chat message or in-head
metadata:
  type: feedback
---

**The owner's pain (2026-07-01):** "We discuss, come up with these best architectures, then LOSE them — we move on to something else and they're gone. Many good ideas got lost. They must not be lost." This is a real orchestration failure: the lead generated rich designs (composition grammar, framework-grade style system, fill contract, per-breakpoint responsive layout, PARTS, …) but held them in chat messages / in-head, with the work board stale — so visions evaporated.

**The fix (built, not promised):** a durable, version-controlled **Architecture & Vision Registry** = `platform/work/ARCHITECTURE-REGISTRY.md` — the SSOT of every high-concept architecture we commit to, each with a 1-line concept, its `DESIGN-*.md`/ADR link, and a lifecycle status (VISION → DESIGNED → BUILDING → BUILT → VERIFIED → DEFERRED/SUPERSEDED). Depth stays in the design docs; the registry is the index that guarantees nothing falls through.

**How to apply (binding on the lead):**
1. **Owner raises an architecture/vision → add a card to the Registry IMMEDIATELY, before moving on.** No vision lives only in a chat message. This is the board rule ("no card → create one first") operationalized for architecture.
2. Every design doc / ADR a lane produces → linked in the Registry with a status. Advance status only on evidence (BUILT = green; VERIFIED = server/real-DB proven).
3. **Consult the Registry at session start and before routing any UI/composition/platform work** — it is the SSOT of committed architectures; it tells you what was promised and where each stands, so nothing is silently dropped when we context-switch.
4. When a vision is genuinely dropped/superseded, mark it SUPERSEDED with the reason — don't let it vanish silently. Deferrals are DEFERRED with the gate, not deleted.

This complements [[orchestrator-briefing-doctrine]] (form + expand briefs), [[elevate-dont-patch-proactive-design]] (the composition/layout vision), and the standing `HUNT-*.md` inventories. The Registry is the memory of AMBITION; the hunts are the memory of DEFECTS.
