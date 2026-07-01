---
name: canonical-semantic-naming
description: Every name (node type, plugin, class, token, config value, i18n label) must reflect WHAT THE THING IS and carry its canonical/domain-standard name — never borrowed generic jargon; architecture leads, so legacy names migrate to the canonical vision (Strangler), not the reverse
metadata:
  type: feedback
---

Names are part of the architecture, held to the same canonical bar as structure. A name must say what the thing IS + use its canonical/domain-standard term — not borrowed generic web/marketing jargon, not an arbitrary label.

**Why (owner, 2026-06-28):** the owner flagged the `hero` node — "why is it necessarily 'HERO'? every name should reflect what it is and its canonical name." Confirmed: the `hero` node is really a page-intro/banner that holds entry-cards (title + subtitle + cards; used as `landing-hero` + `emphasis:"hero"`). "hero" is borrowed marketing-web jargon, not what it is in a stats-dashboard domain. Worse, its label `{ka:"გმირი სექცია"}` is a literal MISTRANSLATION ("გმირი" = warrior/protagonist, meaningless for a web "hero section") — a real i18n defect a naming pass must catch.

**How to apply:**
1. **Audit all names** for semantic + canonical accuracy: node/plugin types, CSS class prefixes, tokens, config discriminant VALUES (e.g. `emphasis:"hero"`), and i18n labels. A name that borrows generic jargon or mislabels its domain meaning is a smell.
2. **Rename to the canonical name** that reflects the thing's real role/standard (e.g. hero → banner/intro/feature-cards; emphasis "hero" → prominent/lead). Set a CONSISTENT taxonomy (the architect decides the whole naming system, not ad-hoc per name).
3. **Architecture leads (Law 7), so legacy conforms to the vision — not the reverse.** Execute renames as a Strangler with ZERO regression: the type literal + folder + registration + `NodeTypeMap` + every provisioning/config reference + i18n labels move together, gated + verified. Don't bend the canonical name to spare a migration; migrate.
4. Don't be timid about a deliberate improving rename — the owner explicitly wants bold, considered steps that improve the work, with the revert-net.

Companions: [[guardian-of-canon]], [[feedback_architecture_direction]] (architecture-leads / existing conforms to our vision), [[elevate-dont-patch-proactive-design]], [[orchestrator-briefing-doctrine]].
