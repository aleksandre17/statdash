# 2. Design principles (named laws engineers cite by name)
- **SOLID** — Single-responsibility · **Open/Closed** (open to extension, closed to modification — add behaviour with new code, don't widen existing) · Liskov substitution · Interface segregation · Dependency inversion.
- **GRASP** — controller, information expert, low coupling, high cohesion, **Protected Variations** (find where it may change, put a stable interface/seam there).
- **DRY · KISS · YAGNI** · Composition over inheritance · Law of Demeter · Principle of least astonishment.
- **Fail fast** · **Make illegal states unrepresentable** (encode invariants in the type system) · **Dependency Injection / IoC** · Convention over configuration · Conway's Law (structure mirrors org).

---

- **Named laws every engineer should wield:** **Single Source of Truth (SSOT)** — every datum has one authoritative home, all else derives · **Postel's Law / robustness** — be conservative in what you send, liberal in what you accept · **Law of Demeter** — talk only to immediate collaborators · **Principle of Least Astonishment** — behavior matches expectation · **Conway's Law** — architecture mirrors team communication · **Fail-fast** — surface errors at the boundary, never swallow · **5 Whys / root-cause** — fix the cause, not the symptom · **Occam's Razor** — simplest explanation first · **One-way vs two-way doors** — irreversible decisions get more scrutiny · **Expand-contract (parallel change)** — evolve contracts/schemas without breaking consumers · **Boy-Scout Rule** — leave it cleaner, bounded by scope · **KISS** · **Chesterton's Fence** — don't remove what you don't understand · **Pareto / vital-few** — the 20% that carries 80% · **Lehman's laws** — software must evolve or rot.
