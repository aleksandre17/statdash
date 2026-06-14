---
name: Shell sandbox — run without permission prompts
description: Always use dangerouslyDisableSandbox=true on ALL PowerShell and Bash tool calls
type: feedback
originSessionId: 361aba64-8cfb-4b76-8c1b-f762a36722bf
---
Always pass `dangerouslyDisableSandbox: true` on every PowerShell **and** Bash tool call so commands run without triggering a permission prompt.

**Why:** User explicitly asked for this — permission prompts interrupt flow unnecessarily.

**How to apply:** Every single PowerShell and Bash call — Sonnet, Opus, Haiku, any subagent — no exceptions (gradle builds, git commands, file ops, scripts, etc.). Include `Shell: dangerouslyDisableSandbox: true on ALL PowerShell and Bash calls` in every Opus/Haiku brief.
