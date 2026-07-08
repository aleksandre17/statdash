/* primitives.js — label cleaning, code-from-label, deterministic slug, codelist builder.
 * Pure, no I/O. The SSOT for the SDMX code-extraction rule (ADR-0030 §5). */
'use strict';

/** Normalise a label: strip embedded newlines, collapse whitespace, trim. */
function cleanLabel(s) {
  if (s == null) return '';
  return String(s).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * The one canonical SDMX code regex (ADR-0030 §5).
 * Each segment = a leading UPPER-CASE letter, then digits/upper, then ONE optional
 * lower-case suffix letter (the conventional SNA suffix: B1g, B8g, D9r, P51g). Segments
 * join on . _ - + . This honours the ADR's stated lifts ((B8g)→B8G, (B2g+B3g)→B2G_B3G,
 * (D2-D3)→D2_D3) while still rejecting prose like "(Mil.Gel)". Result is upper-cased.
 */
const SDMX_SEG = '[A-Z][A-Z0-9]*[a-z]?';
const SDMX_CODE_RE = new RegExp(`\\((${SDMX_SEG}(?:[._\\-+]${SDMX_SEG})*)\\)\\s*$`);

/** Leading structural sign marker "(+) / (-) / (=) / (−)". */
const SIGN_RE = /^\s*\(\s*[+\-=−]\s*\)\s*/;

/**
 * Lift a trailing bracketed SDMX code. Returns { code|null, label } with the
 * matched (CODE) stripped+trimmed. Separators . - space → "_", upper-cased.
 * e.g. "(D2-D3)" → code "D2_D3".
 */
function liftCode(rawLabel) {
  const label0 = cleanLabel(rawLabel);
  const m = label0.match(SDMX_CODE_RE);
  if (!m) return { code: null, label: label0 };
  const code = m[1].replace(/[.\-\s+]+/g, '_').toUpperCase();
  return { code, label: label0.slice(0, m.index).trim() };
}

/** Strip the structural sign marker → { role: 'add'|'subtract'|'total'|null, label }. */
function liftSign(rawLabel) {
  const label0 = cleanLabel(rawLabel);
  const m = label0.match(SIGN_RE);
  if (!m) return { role: null, label: label0 };
  const ch = m[0].replace(/[()\s]/g, '');
  const role = ch === '+' ? 'add' : (ch === '=' ? 'total' : 'subtract'); // '-' or '−'
  return { role, label: label0.slice(m[0].length).trim() };
}

/** ASCII transliteration of Georgian (deterministic slug fallback on ka-only labels). */
const KA2LAT = {
  'ა':'a','ბ':'b','გ':'g','დ':'d','ე':'e','ვ':'v','ზ':'z','თ':'t','ი':'i','კ':'k',
  'ლ':'l','მ':'m','ნ':'n','ო':'o','პ':'p','ჟ':'zh','რ':'r','ს':'s','ტ':'t','უ':'u',
  'ფ':'p','ქ':'k','ღ':'gh','ყ':'q','შ':'sh','ჩ':'ch','ც':'ts','ძ':'dz','წ':'ts',
  'ჭ':'ch','ხ':'kh','ჯ':'j','ჰ':'h',
};
function transliterate(s) {
  return String(s).split('').map((c) => (KA2LAT[c] != null ? KA2LAT[c] : c)).join('');
}

/**
 * Deterministic slug (kebab, ASCII, ≤40 chars). Prefer EN; collision-suffixed via
 * the `seen` Map — DETERMINISTIC, never random (idempotency).
 */
function slugify(label, seen) {
  let base = transliterate(label)
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40).replace(/-+$/g, '');
  if (!base) base = 'x';
  if (!seen) return base;
  let code = base;
  let n = 2;
  while (seen.has(code) && seen.get(code) !== label) {
    code = `${base.slice(0, 38)}_${n}`;
    n += 1;
  }
  seen.set(code, label);
  return code;
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Ordered, de-duplicated codelist for one dimension. `order` = first-seen sequence
 * (deterministic). Re-adding an identical code is a no-op; missing label halves are
 * back-filled; conflicting labels are recorded for the DQAF report.
 */
function makeCodelist(dim) {
  const byCode = new Map();
  const conflicts = [];
  const applied = []; // display-label corrections actually applied (for the report)
  const conflictSeen = new Set(); // dedupe: one report per distinct (code,field,had,got)
  const flagConflict = (code, field, had, got) => {
    const k = `${code}|${field}|${had}|${got}`;
    if (conflictSeen.has(k)) return;
    conflictSeen.add(k);
    conflicts.push({ code, field, had, got });
  };
  return {
    dim,
    add({ code, name_ka = '', name_en = '', parent = '' }) {
      const ex = byCode.get(code);
      if (!ex) {
        byCode.set(code, { code, name_ka, name_en, parent, order: byCode.size + 1 });
      } else {
        if (!ex.name_ka && name_ka) ex.name_ka = name_ka;
        if (!ex.name_en && name_en) ex.name_en = name_en;
        if (name_ka && ex.name_ka && name_ka !== ex.name_ka) flagConflict(code, 'name_ka', ex.name_ka, name_ka);
        if (name_en && ex.name_en && name_en !== ex.name_en) flagConflict(code, 'name_en', ex.name_en, name_en);
      }
      return code;
    },
    has(code) { return byCode.has(code); },
    get(code) { return byCode.get(code); },
    /**
     * DISPLAY-LABEL corrections (SDMX practice: a published code is a stable series-key
     * identity — we fix a typo'd display label, never rename the code). `corrections` is
     * a map { code: { name_en?, name_ka? } }. Runs AFTER codes are derived (codes are
     * slugified/lifted from the original — possibly typo'd — source labels, so they are
     * unaffected). Each application is recorded in `applied` for the report. Fails fast
     * if a correction targets a code that is not in this codelist (catches drift, e.g.
     * a renamed code, instead of silently no-opping).
     */
    applyCorrections(corrections) {
      if (!corrections) return;
      for (const [code, patch] of Object.entries(corrections)) {
        const ex = byCode.get(code);
        if (!ex) throw new Error(`correction targets unknown ${dim} code "${code}" — codelist drift; review the correction map`);
        for (const field of ['name_en', 'name_ka']) {
          if (patch[field] == null) continue;
          if (patch[field] === ex[field]) continue; // already correct → no-op, not recorded
          applied.push({ dim, code, field, from: ex[field], to: patch[field] });
          ex[field] = patch[field];
        }
      }
    },
    rows() { return [...byCode.values()].sort((a, b) => a.order - b.order); },
    conflicts,
    applied,
  };
}

module.exports = {
  cleanLabel, liftCode, liftSign, transliterate, slugify, makeCodelist, isNum,
  SDMX_CODE_RE,
};
