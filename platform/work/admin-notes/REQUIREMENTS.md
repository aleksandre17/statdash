# Administration review — requirements (2026-07-06)

Source: `NA ეროვნული ანგარიშები 06.07.2026.docx` (geostat administration feedback after project demo).
Annotated screenshots: `platform/work/admin-notes/image1..7.png`.

## A. Landing "moving panel" (featured-slider)

**A1 — Slide order.** The slider must show, in order: **(1) GDP indicators → (2) National Accounts → (3) Regions**. Today National Accounts is first; GDP must become the FIRST slide. (image1 = the GDP slide the admin wants first; image2 = National Accounts = "then this"; regions = "and finally, as-is".)

**A2 — GDP slide card order + ADD the deflator.** On the GDP slide the four cards, in this exact order (admin's red numbers on image1):
1. **მშპ საბაზრო ფასებში** (GDP at market prices — 104 598)
2. **რეალური ზრდა** (real growth — +7.5%)
3. **მშპ ერთ სულ მოსახლეზე** (GDP per capita — 10 296.5)
4. **მშპ-ის დეფლატორი** (GDP deflator) — **currently MISSING ("დეფლატორი საერთოდ დაკარგულია")** → must be ADDED. The deflator exists in data (merged into GDP_ANNUAL as the `gdp-deflator` measure); surface it as a featured item.

**A3 — Regional slide width** ("რეზოლუცია ძალიან მცირე ზომისაა… შესაბამისობაში წინა გვერდებთან"): ALREADY FIXED (`width:100%`, deploy 9b4d956). Remaining ask: **if possible, show the regions as % (share)** rather than only absolute GEL — confirm feasibility (share of national GDP/total).

## B. Charts

**B1 — Tooltip template leak (image7, bar "მშპ ნომინალური დინამიკა").** The tooltip literally renders `{fromYear}–{toYear}` (un-interpolated template placeholder, in Latin) instead of the real years (e.g. `2010–2024`). Root-cause the missing template interpolation on the chart tooltip/series-name path and fix.

**B2 — Latin axis/series labels (image7).** "გრაფიკის ღერძზე დასახელება… ლათინურად გამოდის" — axis/series naming appears in Latin on hover/axis; must be localized (ka/en per locale), no raw/Latin leak.

**B3 — Chart subtitle unit label (image5, donut "წარმოების მეთოდით").** The subtitle shows a truncated `„წ" / "ნ.. მლნ ₾"`; the admin wants a full, consistent subtitle: **"2025 წელი, მლნ ლარი"** (year + unit), unified across charts.

**B4 — Numbers off the graph, hover-only — TREEMAP ONLY (image4).** "ციფრები გრაფიკზე წაიშალოს და ციფრები დარჩეს კურსორის მიტანის დროს მხოლოდ" — remove the numeric value labels drawn ON the **treemap** tiles; show the numbers ONLY in the hover tooltip. Keep the tile category labels + the contribution markers (=/+/-). **⚠️ CORRECTION (owner, 2026-07-06): this applies to the TREEMAP ONLY — the DONUT (image5) KEEPS its numbers.** image5's note was about the subtitle (B3), NOT numbers-removal. Do NOT touch the donut/pie value labels.

## C. Regional page — top KPI panel (image6, "რეგიონული ანგარიშები")

**C1 — Value shown twice.** Each KPI prints the % as the big value AND again below as a trend line ("↗ +13.6%") — the same number twice. Show it ONCE (dedupe the redundant trend echo where value==trend).

**C2 — "თბილისის წილი … 637.0%" is WRONG.** A share cannot be 637%. Fix: (a) label it simply **"მშპ-ში წილი"** (share in GDP); (b) when NO region is selected → default to **Georgia = 100%**; (c) root-cause the 637% (wrong denominator/aggregation) so a real region shows its correct share (Tbilisi ≈ ~50%).

## Delivery
All client requirements — implement to the highest standard, verify LIVE by display against these exact screenshots, per-locale (ka+en), Laws intact. Deploy landmine-safe.
