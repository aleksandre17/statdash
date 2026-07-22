---
name: platform-generality
description: "The generality law: never build TO an instance — build the LAW that generates every instance. A platform's power = what it absorbs unchanged, as a declaration. Quote in every build/design brief; test every diff against it."
metadata:
  type: feedback
---
# The Generality Law — build the law, never the instance

**The principle (the lead's operative formulation).** We never build *to* an instance — not to a particular element, page, dataset, schema, format, locale, tenant, or tool. We build the **general law** that generates and carries every instance of its class. Concretely:

1. **Instances are projections.** Any specific thing the system shows or does must be *derivable* from a declaration — a registry entry, a schema, a grammar rule — never hand-assembled for that one case. If you can't point to the declaration an artifact is projected FROM, you've built an instance, not a capability.
2. **Absorb, don't accommodate.** The architecture's fitness is measured by what it can take in **unchanged**: a new content kind, a new data shape, a new standard, a new consumer — each lands as a *declaration added*, never as *code modified* (OCP at system scale). If tomorrow's input would force an edit rather than an entry, today's design is already broken.
3. **The standard pulls upward.** Where the architecture lags the international canon, it rises to meet the canon — the canon is never trimmed down to what we happen to render today. Adopt whole grammars with declared extension points; a partial adoption is a future fork.
4. **Maximum capability, always engaged.** A capability the system carries must be reachable at full strength everywhere its class applies — a power implemented but projected narrowly is a broken promise (and the seed of a parallel mechanism).
5. **The tripwire on every diff:** *"would this line still be right if the concrete thing it serves were swapped tomorrow?"* If no — it is a concretization; find the declaration/registry/projection form, or refuse the change.

6. **The unity axiom — ONE of each load-bearing thing.** One style, one power, one vision, one core, one platform, one framework. Every load-bearing concern has exactly ONE carrier; the second style/mechanism/grammar/editor/pipeline serving the same concern is a FORK — found, named, and dissolved into the one, never left to compete. Narrowing and forking are the same disease seen from two sides: both trade the law for an instance.

This is what separates a platform/framework from a closed, narrowed, concretized build: its power is the ratio of what it can **express** to what had to be **hand-built**.

**The proactivity clause (binding on the lead).** This law is the LEAD's voice, spoken FIRST — at session open, at every design review, before every wave: the lead names how the work at hand serves the one platform, unprompted. An owner having to say "we don't narrow" is a logged lead defect (first instance: 2026-07-22 — the owner articulated both the generality principle AND the unity axiom before the lead did, while the lead's memory held all the fragments unassembled).

**Origin (evidence, owner of the statdash project, 2026-07-22, verbatim — spoken while reviewing a single chart bug, i.e. exactly where a lesser process ships a chart-specific patch):** «ჩვენ რომელიმე კონკრეტულ ჩარტს ან ცხრილს კი არ ვარგებთ, არამედ ვქმნით არქიტექტურას, რომელიც არ უნდა გატყდეს, რომელმაც უნდა გამოიყენოს ყოველთვის თავისი შესაძლებლობის მაქსიმუმი, და რაშიც ჩამოვრჩებით საერთაშორისო სტანდარტებს, იქით ამოიწიოს. მოვა ახალი ნედლი დატა — მოერგოს, ადაპტირდეს… ეს არის პლატფორმის ძალა, ეს არის ფრეიმვორკის ძალა.» The owner then directed: complete the thought agnostically, in the lead's words — hence this formulation.

**How to apply:** quote the principle block in every build/design brief as the judging bar; agents self-test their diff against §5 before returning.
