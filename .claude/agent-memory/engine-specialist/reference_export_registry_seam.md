---
name: export-registry-seam
description: Export registry is the SSOT for formats; SerializeFn returns string|Uint8Array (binary OOXML); ExportFormatId closes the leaky union
metadata:
  type: reference
---

Export capability lives in `platform/packages/core/src/data/export/**` (registry-driven OCP — a new format = a new `registerExport(id, {...})`, zero consumer edits).

- `SerializeFn` returns `string | Uint8Array`. Text formats (csv, sdmx-json) return `string`; binary container formats (xlsx / OOXML / zip) return `Uint8Array`. The download layer (`packages/react/.../useExport.ts`) wraps a `Uint8Array` as a raw `BlobPart` so bytes are NOT UTF-8 re-encoded (which corrupts the zip). Do not narrow this back to `string`.
- **xlsx is dep-free.** `formats/zip.ts` is a self-contained STORED-entry PKZIP writer (CRC32 + record layout, ~100 LOC); `formats/xlsx.ts` emits 5 static OOXML XML parts zipped. Chosen over exceljs/SheetJS to keep `packages/core` (the lean engine) dependency-free. STORED (method 0, no DEFLATE) is valid OOXML.
- **SSOT for available formats = the registry**, via `listExportFormats()`. The format-id value type is `ExportFormatId` (= `string`, an open set) exported from the engine. Consumers (ExportBar `onExport`, `data:export` command `format`) use `ExportFormatId`, NOT a hand-maintained `'csv' | 'xlsx'` literal union (which drifts from the registry — that was Q-4 leak). ExportBar renders one button per `listExportFormats()` entry, so a newly-registered format surfaces with no consumer edit.

Tests: `formats/xlsx.test.ts` includes a test-only STORED-zip reader to assert OOXML parts + cell contents without a zip dep; `ExportBar.test.tsx` asserts button-count == `listExportFormats().length` (guards the leaky union). See also [[reference_validate_config_seam]].
