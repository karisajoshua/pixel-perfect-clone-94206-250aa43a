## Problem
On `/admin/ipen` → OCR tab, uploading an image shows toast "Maximum call stack size exceeded". Cause: `OcrTab` in `src/routes/_authenticated/admin.ipen.tsx` base64-encodes with `btoa(String.fromCharCode(...new Uint8Array(buf)))`. Spreading a large Uint8Array into `String.fromCharCode` blows the JS call stack for any real photo (>~100KB).

## Fix
Replace the one-shot spread with the same chunked binary→base64 loop already used in `src/components/ipen/ocr-button.tsx` (0x8000-byte chunks via `String.fromCharCode.apply(null, Array.from(subarray))` then `btoa`).

## Files touched
- `src/routes/_authenticated/admin.ipen.tsx` — patch `OcrTab.onFile` only.

Out of scope: OCR server function, IPEN upstream behavior, UI redesign.
