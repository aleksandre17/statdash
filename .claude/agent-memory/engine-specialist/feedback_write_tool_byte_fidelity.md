---
name: write-tool-byte-fidelity
description: The Write tool does not preserve exotic whitespace (e.g. non-breaking space U+00A0) when content is retyped from memory — it silently substitutes a regular space
metadata:
  type: feedback
---

When moving code/text between files (e.g. splitting a large file into a sub-module), do not
retype formatter/i18n strings or any content containing non-ASCII whitespace (non-breaking
space U+00A0, thin space, etc.) from memory into a `Write` call — the tool substitutes a plain
space, silently corrupting the byte content even though the visible diff looks identical.

**Why:** discovered while splitting `transform.ts` into a `transform/` sub-module — a formatter
string containing U+00A0 was reconstructed by hand and came out with a regular space, which only
surfaced as a downstream rendering/test mismatch, not an edit-time error.

**How to apply:** when relocating exact byte content between files, read the source with a tool
that shows raw bytes are preserved (or use `Edit`, which does a literal string match/replace and
therefore cannot silently normalize whitespace) rather than reading-then-rewriting through
`Write`. If `Write` must be used for a full-file move, verify byte-identity afterward (e.g. diff
the old and new file, or grep for the exact codepoint) rather than trusting a visual read-back.
