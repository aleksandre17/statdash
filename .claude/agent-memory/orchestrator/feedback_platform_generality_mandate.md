---
name: platform-generality-mandate
description: "Owner doctrine (2026-07-22, verbatim): we fit NO specific chart/table/raw-data — we build an architecture that never breaks, always uses its maximum capability, pulls itself UP to the international standard where it lags, and ADAPTS to any new raw data. Quote it in build briefs."
metadata:
  type: feedback
---
**Owner (2026-07-22, verbatim):** «ჩვენ რომელიმე კონკრეტულ ჩარტს ან ცხრილს კი არ ვარგებთ, არამედ ვქმნით არქიტექტურას, რომელიც არ უნდა გატყდეს, რომელმაც უნდა გამოიყენოს ყოველთვის თავისი შესაძლებლობის მაქსიმუმი, და რაშიც ჩამოვრჩებით საერთაშორისო სტანდარტებს, იქით ამოიწიოს. მოვა ახალი ნედლი დატა — მოერგოს, ადაპტირდეს. არ ვქმნით რაღაც კონკრეტულ raw data-ზე მორგებულს. ეს არის პლატფორმის ძალა, ეს არის ფრეიმვორკის ძალა — ამით განსხვავდება ჩაკეტილი, დავიწროებული, კონკრეტიზირებული არქიტექტურისგან.»

**Why:** the owner's crystallization of Laws 1+4+7 in one test — spoken while reviewing a concrete chart bug, i.e. precisely at the moment a lesser process would have shipped a chart-specific patch. It is the anti-body against the platform's recurring disease (privileged literals, per-kind switches, page-specific fixes).

**How to apply:**
1. QUOTE it in every build/design brief as the bar (alongside the verbatim task directive) — agents must judge their own fix against it.
2. The test on any diff: "would this line still be right if the dataset, the chart kind, or the page were swapped tomorrow?" If no → it's a concretization; find the declaration/registry/projection form.
3. "Lags behind the standard → pulls UP" = capability-injection duty (never freeze at parity with our own past); "new raw data adapts" = the DSD/offer/scope machinery must derive from data, never enumerate it.
4. Pairs with [[pipeline-full-power-simple]] (max capability, never trimmed), [[architecture-leads-project-migrates]] (Law 7), [[capability-injection-pipeline]]; the E1 capability matrix, C4 Offer Port and 0113 encoding registry are its executable forms.
