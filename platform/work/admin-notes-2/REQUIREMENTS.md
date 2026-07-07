# Administration review #2 — requirements (2026-07-07)

Source: `NA ეროვნული ანგარიშები 07.07.2026.docx`. Screenshots: `platform/work/admin-notes-2/image1..11.png`.

## R1 — Remove the top-nav name links (image1)
The landing header's nav links (მთლიანი შიდა პროდუქტი / ეროვნული ანგარიშები / რეგიონული ანალიზი) are circled with "these names aren't needed" — they're redundant with the hero cards + sidebar. REMOVE the top-nav menu links (keep logo, locale toggle, theme, socials). ⚠️ confirm scope with owner (significant nav change).

## R2 — Featured-slider cards must show the % change (image2,3,4,5)
Like the inner-page KPIs. Today the National-Accounts slide cards show NO trend, and the GDP cards show a stuck **"→ 0%"**. Wanted (image5): each card shows its yoy change as a coloured trend line, e.g. GNI `↗ +13.8% წინა წელთან`, GDI `↗ +13%`, Saving `↗ +8.5%`, Net lending `↘ -41.8%`; GDP/per-capita show their REAL yoy (not 0%). Add/fix the yoy `trend` on the GDP + accounts featured items so the % change renders correctly (the "→ 0%" is a bug). Regional cards keep the share (see R3), not a yoy.

## R3 — Regional share label (image6)
"ეროვნული ჯამის წილი" → **"წილი მთლიან მშპ-ში"** / EN "Share in total GDP". (The directionless-share display from the prior batch stays; only the wording changes.)

## R4 — Unify ALL chart subtitles to the "წელი" form (image7)
Some subtitles read `2025 წელი, მლნ ლარი` (the fixed donut) but others still read `2025 · მლნ ₾` (dash). Make EVERY chart-section subtitle the unified form: **`{time} წელი, მლნ ლარი`** / EN `{time}, GEL mn` (replace the `· მლნ ₾` dash form). Sweep all pages (accounts/gdp/regional). Handle range subtitles (`{fromYear}–{toYear}`) sensibly (e.g. `{fromYear}–{toYear} წლები, მლნ ლარი`).

## R5 — Download options one colour / like the prices portal (image8,9; text)
The current per-panel export buttons (↓ CSV / ↓ XLSX / ↓ SDMX-JSON) are multi-coloured/cluttered. Admin ref = https://prices.geostat.ge/inflation?lang=ka (uniform outlined buttons). **This is already being addressed** by the in-flight owner-requested redesign → a single compact download-ICON + dropdown, one consistent colour. Ensure that redesign lands with ONE colour/style.

## R6 — Remove the x-axis scale on the regional bar chart (image10)
The horizontal bar chart (რეგიონული) shows an x-axis tick scale (`5k 10k … 45k`) that's redundant — each bar already carries its value label. "remove this too" → hide the x-axis (ticks/gridlines/scale) on that bar chart. Keep the per-bar value labels + region names.

## R7 — Fix the (broken) methodology link (image11; text)
The footer "მეთოდოლოგიური განმარტებები" methodology link is broken after the site update. Replace with the new locale-specific URLs:
- ka: https://www.geostat.ge/ka/modules/categories/119/methodologia-erovnuli-angarishebi
- en: https://www.geostat.ge/en/modules/categories/119/national-accounts

## Delivery
Client requirements — highest standard, verify LIVE by display per screenshot, ka+en, Laws intact, landmine-safe deploy.
