# plugins/ — Shell Layer Orientation

> ავტოლოადი plugins/-ის ნებისმიერ ფაილზე მუშაობისას.
> **Layer orientation only** — shell anatomy / Chrome zero-props / ISP / OCP field-level rules → `.claude/rules/plugins.md`.

---

## Page Anatomy — ONS / Eurostat Standard

```
PageHeader → FilterBar (sticky) → KPI strip → Sections [chart ↔ table] → Methodology footer
```

Progressive disclosure: KPI → chart → table → methodology. Secondary sections collapsed by default.

---

## UI / UX Principles

- **Clarity over cleverness (ONS)** — data უნდა გვესმოდეს, არ უნდა გვაკვირვებდეს
- **Data integrity (IMF / Eurostat)** — preliminary badge · last updated · methodology link · revision note
- **Accessibility WCAG 2.1 AA** — semantic HTML · aria-label · keyboard nav · no color-only info
- **Export (Eurostat / World Bank)** — Excel + CSV ყოველ section-ზე (ახლა: stub)
- **URL = permalink** — ✅ FilterContext + useSearchParams
- **Chart / Table toggle** — ✅ SectionBlock

---

Full shell spec → `.claude/individual/migration/06-shells.md`
