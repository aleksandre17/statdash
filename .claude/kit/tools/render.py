#!/usr/bin/env python3
"""render.py — the SINGLE source-of-truth renderer for the harness-required rendered layer.

`.claude/kit/` is the SSOT (portable doctrine). `.claude/{agents,commands,skills}/` are
GENERATED PROJECTIONS of it, required at those exact paths by the Claude Code harness.
This module IS the render() function; the re-render step, bootstrap.py (scaffold), and
doctor.py (drift guard) all call it — so "rendered == render(kit)" is enforced by ONE
definition (DRY/SSOT), and hand-editing a rendered file can never silently drift again.

Modes:
  python render.py            # --check (default): report drift; exit 1 if any, 0 if clean
  python render.py --check
  python render.py --apply    # write the rendered projection (fixes drift); exit 0

Render rules (per layer):
  commands  : deterministic shim = frontmatter(description derived from the kit H1 title,
              generic argument-hint) + a fixed "read the canonical kit procedure" body.
  agents    : verbatim byte-for-byte copy of kit/agents/<name>.md, EXCEPT orchestrator: the
              literal '<module>-specialist' token in its Agent(...) allowlist is substituted
              with the project's PRESENT specialists (the *-specialist.md files already in
              .claude/agents/, which are project-local and preserved), sorted for determinism.
  skills    : verbatim byte-for-byte copy of kit/skills/<sk>/SKILL.md.

Project-local files with NO kit source (commands/dev.md, commands/laws.md, *-specialist.md)
are PRESERVED — never written by --apply, never flagged by --check.
All output is LF-normalized (kit is LF); comparison is byte-exact.
"""
import os, re, sys

_HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or os.path.abspath(os.path.join(_HERE, "..", "..", ".."))
KIT = os.path.join(ROOT, ".claude", "kit")


def _read_bytes(path):
    with open(path, "rb") as f:
        return f.read()


def _norm(b):
    """Normalize to LF bytes so comparison/writes are EOL-exact on any platform."""
    return b.replace(b"\r\n", b"\n").replace(b"\r", b"\n")


# ---------------- commands ----------------

def _command_description(name, kit_text):
    """Derive the slash-menu description from the kit command's H1 title (SSOT).
    '# /mode — operating-mode switch' -> 'operating-mode switch'.
    A title that is not a '/name …' slug is used whole (e.g. senior.md)."""
    for ln in kit_text.splitlines():
        s = ln.strip()
        if s.startswith("# "):
            title = s[2:].strip()
            if title.startswith("/" + name):
                rest = title[len("/" + name):].lstrip(" —–-:·")
                return rest or title
            return title
    return f"Run the /{name} playbook"


def _yaml_scalar(v):
    """Quote a description only when a bare YAML scalar would be ambiguous."""
    if v == "" or v[0] in "!&*?|>@`\"'%#[]{},:" or ": " in v or v.rstrip() != v:
        return '"' + v.replace('"', '\\"') + '"'
    return v


def render_command(name, kit_text):
    """kit command text -> the deterministic rendered shim text (LF)."""
    desc = _yaml_scalar(_command_description(name, kit_text))
    return (
        "---\n"
        f"description: {desc}\n"
        "argument-hint: [scope/target]\n"
        "---\n"
        f"Run the **/{name}** playbook. Canonical procedure: "
        f"`.claude/kit/commands/{name}.md` — read it and follow it exactly. "
        "Args: $ARGUMENTS.\n"
    )


# ---------------- agents ----------------

def present_specialists(agents_dir):
    """Project-local specialists already rendered in .claude/agents/ (sorted, deterministic)."""
    if not os.path.isdir(agents_dir):
        return []
    return sorted(
        f[:-3] for f in os.listdir(agents_dir)
        if f.endswith("-specialist.md")
    )


def render_agent(name, kit_text, specialists):
    """Verbatim, except orchestrator: substitute the <module>-specialist allowlist token."""
    if name == "orchestrator" and specialists and "<module>-specialist" in kit_text:
        return kit_text.replace("<module>-specialist", ", ".join(specialists))
    return kit_text


# ---------------- skills ----------------

def render_skill(kit_text):
    return kit_text


# ---------------- projection driver ----------------

def expected_projection():
    """Yield (dst_abs, expected_bytes) for every generated file the harness requires.
    Only files that HAVE a kit source are yielded; project-local files are untouched."""
    out = []
    specialists = present_specialists(os.path.join(ROOT, ".claude", "agents"))

    # commands
    cmd_dir = os.path.join(KIT, "commands")
    if os.path.isdir(cmd_dir):
        for fn in sorted(os.listdir(cmd_dir)):
            if not fn.endswith(".md"):
                continue
            name = fn[:-3]
            kit_text = _norm(_read_bytes(os.path.join(cmd_dir, fn))).decode("utf-8")
            dst = os.path.join(ROOT, ".claude", "commands", fn)
            out.append((dst, render_command(name, kit_text).encode("utf-8")))

    # agents
    ag_dir = os.path.join(KIT, "agents")
    if os.path.isdir(ag_dir):
        for fn in sorted(os.listdir(ag_dir)):
            if not fn.endswith(".md") or fn.endswith(".md.template"):
                continue
            name = fn[:-3]
            kit_text = _norm(_read_bytes(os.path.join(ag_dir, fn))).decode("utf-8")
            dst = os.path.join(ROOT, ".claude", "agents", fn)
            out.append((dst, render_agent(name, kit_text, specialists).encode("utf-8")))

    # skills
    sk_dir = os.path.join(KIT, "skills")
    if os.path.isdir(sk_dir):
        for sk in sorted(os.listdir(sk_dir)):
            src = os.path.join(sk_dir, sk, "SKILL.md")
            if not os.path.isfile(src):
                continue
            kit_text = _norm(_read_bytes(src)).decode("utf-8")
            dst = os.path.join(ROOT, ".claude", "skills", sk, "SKILL.md")
            out.append((dst, render_skill(kit_text).encode("utf-8")))

    return out


def check():
    drift = []
    for dst, expected in expected_projection():
        rel = os.path.relpath(dst, ROOT).replace(os.sep, "/")
        if not os.path.exists(dst):
            drift.append(("MISSING", rel))
        elif _norm(_read_bytes(dst)) != expected:
            drift.append(("DRIFT", rel))
    return drift


def apply():
    written = []
    for dst, expected in expected_projection():
        cur = _norm(_read_bytes(dst)) if os.path.exists(dst) else None
        if cur == expected:
            continue
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with open(dst, "wb") as f:
            f.write(expected)
        written.append(os.path.relpath(dst, ROOT).replace(os.sep, "/"))
    return written


def main(argv):
    mode = "--apply" if "--apply" in argv else "--check"
    if mode == "--apply":
        written = apply()
        print(f"render --apply: {len(written)} file(s) re-rendered from kit/")
        for w in written:
            print(f"  ~ {w}")
        if not written:
            print("  (all already in sync)")
        return 0
    drift = check()
    if drift:
        print(f"render --check: {len(drift)} rendered file(s) DRIFTED from render(kit/):")
        for kind, rel in drift:
            print(f"  [x] {kind}: {rel}")
        print("  -> run: python .claude/kit/tools/render.py --apply")
        return 1
    print("render --check: rendered layer == render(kit/) [OK]")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
