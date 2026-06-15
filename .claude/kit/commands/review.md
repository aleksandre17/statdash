# /review — Opus-as-Reviewer on a diff playbook

> Invoke: "review this" · "Opus review the diff/branch" · the B.3 safety-net path (Sonnet built, want senior eyes).
> Cheaper than `--b` (~4k vs ~15k) and the right call when the work was *built* but you want judgment on the result.

**Who:** Opus reviews (judgment on the diff). Sonnet prepared the diff; Sonnet relays the verdict undistorted (`01` D — a blocker stays a blocker).
**Reads:** the diff / branch · the brief or goal it was meant to satisfy · `CLAUDE.md` laws + `project.json law_patterns`.
**Output:** a review verdict (inline or `<paths.audit_dir>` if large).
**Records:** actionable issues → fixed now or → `project_debt`; a `clean` verdict noted in the layer record.
**Done when:** every changed file is judged and the verdict is one of: `clean` · `fix-then-ship` (with the list) · `block` (with reason).

## Procedure
1. **Premise check** — does the diff actually solve the stated goal? Wrong premise → block (`feedback_brief_is_hypothesis`).
2. **Standard scan** — hardcode · DRY · SOLID · one-body · boundary · P-laws · naming · tests adequate? (`03` observation duty — surface even unasked.)
3. **Verdict** — `clean` / `fix-then-ship: [list]` / `block: [reason]`. Quote the finding line before interpretation.
4. **No silent rewrite** — reviewer flags; it does not quietly rewrite the author's work (`feedback_opus_work_protection`).
