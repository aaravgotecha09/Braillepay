/*
 * BraillePay Braille mapping table (v2).
 *
 * A cell is an array of raised dot numbers (standard 6-dot numbering).
 * A character maps to an ordered LIST of cells, because several symbols and
 * capital letters are multi-cell in Unified English Braille (UEB).
 *
 * Conventions (recorded per entry as "code"):
 *   'UEB'           Unified English Braille (ICEB / BANA). Used wherever a UEB source defines the symbol.
 *   'BRAILLE-ASCII' Braille ASCII / computer-braille 6-dot convention. Used only for '#', which
 *                   UEB does not define as a symbol (UEB uses dots 3-4-5-6 as the number indicator).
 *
 * Status per entry:
 *   'verified-2-sources'  two independent sources agree (see SOURCES)
 *   'verified-1-source'   one source; check against the ICEB Rules of UEB before production use
 *   'unverified-existing' kept from the original Grade-1 table and not re-checked in this pass
 *   'unsupported'         no verified source defines it; announced, never drawn as a made-up pattern
 *
 * Case is significant: 'a' and 'A' are different. A capital letter is the UEB capital
 * sign (dot 6) followed by the lower-case letter, so it is two cells.
 *
 * Loaded as a plain <script> in the browser (exposes window.BraillePayBraille)
 * and as a CommonJS module under Node (used by tests and tools).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.BraillePayBraille = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  /* Sources cited by the entries. URLs are the pages that were fetched during verification. */
  var SOURCES = {
    LIBLOUIS_UEB: {
      id: 'LIBLOUIS_UEB',
      title: 'liblouis UEB tables: en-ueb-chardefs.uti and en-ueb-g1.ctb (UEB symbol definitions)',
      url: 'https://third-party-mirror.googlesource.com/liblouis_for_aas/+/refs/heads/master/liblouis/tables/en-ueb-chardefs.uti'
    },
    BANA_NLS_SYMBOLS: {
      id: 'BANA_NLS_SYMBOLS',
      title: 'Braille Authority of North America, "Frequently used UEB symbols" (NLS). Dot locator notation decoded against Braille ASCII.',
      url: 'https://brailleauthority.org/ueb/NLS%20frequently%20used%20ueb%20symbols.pdf'
    },
    BRAILLE_ASCII: {
      id: 'BRAILLE_ASCII',
      title: 'Braille ASCII (North American Braille ASCII code) table',
      url: 'https://en.wikipedia.org/wiki/Braille_ASCII'
    },
    LSU_COMPUTER_BRAILLE: {
      id: 'LSU_COMPUTER_BRAILLE',
      title: 'LSU HDC, "Computer Braille code description" (ASCII table for computer Braille input)',
      url: 'https://www.hdc.lsuhsc.edu/ladbp/docs/Computer%20Braille%20code%20description.pdf'
    }
  };

  var V2 = 'verified-2-sources', V1 = 'verified-1-source', UNV = 'unverified-existing';

  /*
   * ENTRIES: one row per symbol character. Letters are generated below.
   * cells: the ordered cell sequence. sources: ids from SOURCES.
   */
  var ENTRIES = {
    /* ---- punctuation ---- */
    '!':  { cells: [[2, 3, 5]], code: 'UEB', status: UNV, sources: [], note: 'Kept from the original Grade-1 table.' },
    '"':  { cells: [[2, 3, 6]], code: 'UEB', status: V1, sources: ['LIBLOUIS_UEB'], note: 'Opening quotation mark (prepunc 236). Closing mark is 3-5-6 (postpunc 356); the form depends on position.' },
    "'":  { cells: [[3]], code: 'UEB', status: V1, sources: ['LIBLOUIS_UEB'], note: 'Apostrophe (punctuation 3).' },
    ',':  { cells: [[2]], code: 'UEB', status: V1, sources: ['LIBLOUIS_UEB'], note: 'Comma (punctuation 2).' },
    '-':  { cells: [[3, 6]], code: 'UEB', status: V1, sources: ['LIBLOUIS_UEB'], note: 'Hyphen-minus (punctuation 36).' },
    '.':  { cells: [[2, 5, 6]], code: 'UEB', status: V1, sources: ['LIBLOUIS_UEB'], note: 'Full stop (punctuation 256).' },
    '/':  { cells: [[4, 5, 6], [3, 4]], code: 'UEB', status: V1, sources: ['LIBLOUIS_UEB'], note: 'Solidus: dot 4-5-6 then 3-4.' },
    ':':  { cells: [[2, 5]], code: 'UEB', status: UNV, sources: [], note: 'Kept from the original Grade-1 table.' },
    ';':  { cells: [[2, 3]], code: 'UEB', status: V1, sources: ['LIBLOUIS_UEB'], note: 'Semicolon (punctuation 23).' },
    '?':  { cells: [[2, 3, 6]], code: 'UEB', status: V1, sources: ['LIBLOUIS_UEB'], note: 'Question mark after a word (postpunc 236). Standing alone it is 56-236.' },

    /* ---- symbols defined by UEB ---- */
    '@':  { cells: [[4], [1]], code: 'UEB', status: V2, sources: ['LIBLOUIS_UEB', 'BANA_NLS_SYMBOLS'], note: 'At sign: "@a" (dot 4, then dot 1). Used in UPI IDs.' },
    '&':  { cells: [[4], [1, 2, 3, 4, 6]], code: 'UEB', status: V1, sources: ['LIBLOUIS_UEB'], note: 'Ampersand: "@&". The NLS guide does not list it.' },
    '#':  { cells: [[3, 4, 5, 6]], code: 'BRAILLE-ASCII', status: V2, sources: ['BRAILLE_ASCII', 'LSU_COMPUTER_BRAILLE'], note: 'Number sign. UEB uses the same pattern (3-4-5-6) as its numeric indicator, so a standalone # and a number indicator look the same.' },
    '$':  { cells: [[4], [2, 3, 4]], code: 'UEB', status: V2, sources: ['LIBLOUIS_UEB', 'BANA_NLS_SYMBOLS'], note: 'Dollar sign: "@s" (dot 4, then 2-3-4).' },
    '%':  { cells: [[4, 6], [3, 5, 6]], code: 'UEB', status: V2, sources: ['LIBLOUIS_UEB', 'BANA_NLS_SYMBOLS'], note: 'Percent sign: ".0" (dots 4-6, then 3-5-6).' },
    '(':  { cells: [[5], [1, 2, 6]], code: 'UEB', status: V2, sources: ['LIBLOUIS_UEB', 'BANA_NLS_SYMBOLS'], note: 'Opening parenthesis (dot 5, then 1-2-6).' },
    ')':  { cells: [[5], [3, 4, 5]], code: 'UEB', status: V2, sources: ['LIBLOUIS_UEB', 'BANA_NLS_SYMBOLS'], note: 'Closing parenthesis (dot 5, then 3-4-5).' },
    '*':  { cells: [[5], [3, 5]], code: 'UEB', status: V2, sources: ['LIBLOUIS_UEB', 'BANA_NLS_SYMBOLS'], note: 'Asterisk (dot 5, then 3-5).' },
    '+':  { cells: [[5], [2, 3, 5]], code: 'UEB', status: V2, sources: ['LIBLOUIS_UEB', 'BANA_NLS_SYMBOLS'], note: 'Plus sign (dot 5, then 2-3-5).' },
    '<':  { cells: [[4], [1, 2, 6]], code: 'UEB', status: V2, sources: ['LIBLOUIS_UEB', 'BANA_NLS_SYMBOLS'], note: 'Less-than sign (dot 4, then 1-2-6).' },
    '=':  { cells: [[5], [2, 3, 5, 6]], code: 'UEB', status: V2, sources: ['LIBLOUIS_UEB', 'BANA_NLS_SYMBOLS'], note: 'Equals sign (dot 5, then 2-3-5-6).' },
    '>':  { cells: [[4], [3, 4, 5]], code: 'UEB', status: V2, sources: ['LIBLOUIS_UEB', 'BANA_NLS_SYMBOLS'], note: 'Greater-than sign (dot 4, then 3-4-5).' },
    '[':  { cells: [[4, 6], [1, 2, 6]], code: 'UEB', status: V2, sources: ['LIBLOUIS_UEB', 'BANA_NLS_SYMBOLS'], note: 'Opening bracket (dots 4-6, then 1-2-6).' },
    ']':  { cells: [[4, 6], [3, 4, 5]], code: 'UEB', status: V2, sources: ['LIBLOUIS_UEB', 'BANA_NLS_SYMBOLS'], note: 'Closing bracket (dots 4-6, then 3-4-5).' },
    '\\': { cells: [[4, 5, 6], [1, 6]], code: 'UEB', status: V2, sources: ['LIBLOUIS_UEB', 'BANA_NLS_SYMBOLS'], note: 'Backslash (dots 4-5-6, then 1-6).' },
    '^':  { cells: [[4], [2, 6]], code: 'UEB', status: V1, sources: ['LIBLOUIS_UEB'], note: 'Caret (dot 4, then 2-6). Braille ASCII uses a different pattern (4-5); UEB is used here.' },
    '_':  { cells: [[4, 6], [3, 6]], code: 'UEB', status: V2, sources: ['LIBLOUIS_UEB', 'BANA_NLS_SYMBOLS'], note: 'Low line / underscore (dots 4-6, then 3-6).' },
    '`':  { cells: [[4, 6], [1, 6]], code: 'UEB', status: V1, sources: ['LIBLOUIS_UEB'], note: 'Grave accent (dots 4-6, then 1-6).' },
    '{':  { cells: [[4, 5, 6], [1, 2, 6]], code: 'UEB', status: V2, sources: ['LIBLOUIS_UEB', 'BANA_NLS_SYMBOLS'], note: 'Opening brace (dots 4-5-6, then 1-2-6).' },
    '|':  { cells: [[4, 5, 6], [1, 2, 5, 6]], code: 'UEB', status: V1, sources: ['LIBLOUIS_UEB'], note: 'Vertical bar (dots 4-5-6, then 1-2-5-6).' },
    '}':  { cells: [[4, 5, 6], [3, 4, 5]], code: 'UEB', status: V2, sources: ['LIBLOUIS_UEB', 'BANA_NLS_SYMBOLS'], note: 'Closing brace (dots 4-5-6, then 3-4-5).' },
    '~':  { cells: [[4], [3, 5]], code: 'UEB', status: V2, sources: ['LIBLOUIS_UEB', 'BANA_NLS_SYMBOLS'], note: 'Tilde (dot 4, then 3-5).' },

    /* ---- currency (UEB) ---- */
    '€':  { cells: [[4], [1, 5]], code: 'UEB', status: V1, sources: ['LIBLOUIS_UEB'], note: 'Euro sign (dot 4, then 1-5).' },
    '£':  { cells: [[4], [1, 2, 3]], code: 'UEB', status: V1, sources: ['LIBLOUIS_UEB'], note: 'Pound sign (dot 4, then 1-2-3).' },
    '¢':  { cells: [[4], [1, 4]], code: 'UEB', status: V1, sources: ['LIBLOUIS_UEB'], note: 'Cent sign (dot 4, then 1-4).' },

    /* ---- mathematical symbols (UEB) ---- */
    '÷':  { cells: [[5], [3, 4]], code: 'UEB', status: V1, sources: ['BANA_NLS_SYMBOLS'], note: 'Division sign: ".=\"/" in the NLS guide, decoded as dot 5 then Braille ASCII "/" (3-4). liblouis does not define it.' },
    '≤':  { cells: [[4, 5, 6], [4], [1, 2, 6]], code: 'UEB', status: V1, sources: ['LIBLOUIS_UEB'], note: 'Less-than or equal to (three cells: 4-5-6, 4, 1-2-6).' },
    '≥':  { cells: [[4, 5, 6], [4], [3, 4, 5]], code: 'UEB', status: V1, sources: ['LIBLOUIS_UEB'], note: 'Greater-than or equal to (three cells: 4-5-6, 4, 3-4-5).' }
  };

  /* Characters with NO verified pattern in any consulted source. They are announced as unsupported. */
  var UNSUPPORTED = {
    '₹': 'Rupee sign: no UEB definition in the consulted sources.',
    '×': 'Multiplication sign: not defined in the consulted UEB sources.',
    '±': 'Plus-minus sign: not defined in the consulted sources (UEB defines minus-or-plus, which is a different sign).',
    '≠': 'Not-equal sign: not defined in the consulted UEB sources.'
  };

  /* Capital letter sign (UEB dot 6), placed before a lower-case letter. Source: liblouis en-ueb-g1.ctb (capsign 6). */
  var CAPITAL_SIGN = [6];

  /* Lower-case Grade-1 alphabet. Matches the Braille ASCII table rows for A-Z (Wikipedia). */
  var LETTERS = {
    'a': [1], 'b': [1, 2], 'c': [1, 4], 'd': [1, 4, 5], 'e': [1, 5], 'f': [1, 2, 4], 'g': [1, 2, 4, 5],
    'h': [1, 2, 5], 'i': [2, 4], 'j': [2, 4, 5], 'k': [1, 3], 'l': [1, 2, 3], 'm': [1, 3, 4], 'n': [1, 3, 4, 5],
    'o': [1, 3, 5], 'p': [1, 2, 3, 4], 'q': [1, 2, 3, 4, 5], 'r': [1, 2, 3, 5], 's': [2, 3, 4], 't': [2, 3, 4, 5],
    'u': [1, 3, 6], 'v': [1, 2, 3, 6], 'w': [2, 4, 5, 6], 'x': [1, 3, 4, 6], 'y': [1, 3, 4, 5, 6], 'z': [1, 3, 5, 6]
  };

  /* Digits use the UEB numeric rule: a number sign (3-4-5-6) followed by letters a-j. The number sign is
     handled by the playback timing, so each digit is the letter cell here. */
  var DIGITS = { '1': 'a', '2': 'b', '3': 'c', '4': 'd', '5': 'e', '6': 'f', '7': 'g', '8': 'h', '9': 'i', '0': 'j' };

  var UNSUPPORTED_MESSAGE = 'No Braille mapping for this character. It is shown as a full cell and announced as unsupported.';

  function clone(cells) { return cells.map(function (c) { return c.slice(); }); }

  function hasOwn(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }

  /** Lookup a character. Returns the cell sequence, or null if the character has no verified mapping.
   *  Space is handled by the caller (it has no cells). */
  function getCells(ch) {
    if (typeof ch !== 'string' || ch.length !== 1) { return null; }
    if (ch >= 'A' && ch <= 'Z') {
      return [CAPITAL_SIGN.slice()].concat([LETTERS[ch.toLowerCase()].slice()]);
    }
    if (hasOwn(LETTERS, ch)) { return [LETTERS[ch].slice()]; }
    if (hasOwn(DIGITS, ch)) { return [LETTERS[DIGITS[ch]].slice()]; }
    if (hasOwn(ENTRIES, ch)) { return clone(ENTRIES[ch].cells); }
    return null;
  }

  /** Mapping status for one character: 'letter', 'digit', 'symbol' entries carry a verification status. */
  function statusOf(ch) {
    if (ch === ' ') { return 'space'; }
    if (/[A-Za-z]/.test(ch)) { return 'verified-1-source'; }   // alphabet, Braille ASCII rows
    if (/[0-9]/.test(ch)) { return 'unverified-existing'; }   // UEB numeric rule, not re-fetched
    if (hasOwn(ENTRIES, ch)) { return ENTRIES[ch].status; }
    if (hasOwn(UNSUPPORTED, ch)) { return 'unsupported'; }
    return 'unsupported';
  }

  /** True when the character has a documented mapping. Space is handled separately. */
  function isSupported(ch) {
    return getCells(ch) !== null;
  }

  /** Category used by the UI: letter, digit, space or symbol. */
  function categoryOf(ch) {
    if (ch === ' ') { return 'space'; }
    if (/[A-Za-z]/.test(ch)) { return 'letter'; }
    if (/[0-9]/.test(ch)) { return 'digit'; }
    return 'symbol';
  }

  /** Reason text for an unsupported character (empty string if supported). */
  function unsupportedReason(ch) {
    if (hasOwn(UNSUPPORTED, ch)) { return UNSUPPORTED[ch]; }
    return isSupported(ch) || ch === ' ' ? '' : UNSUPPORTED_MESSAGE;
  }

  /** Per-character report for a string. */
  function describe(text) {
    return Array.prototype.map.call(String(text || ''), function (ch) {
      var cells = getCells(ch);
      return {
        char: ch,
        category: categoryOf(ch),
        supported: cells !== null || ch === ' ',
        cells: cells,
        status: statusOf(ch),
        code: cells === null ? null : (hasOwn(ENTRIES, ch) ? ENTRIES[ch].code : 'UEB')
      };
    });
  }

  /** Every mapped character, in a stable order, for the reference document and the symbol library. */
  function referenceTable() {
    var rows = [];
    function row(ch, cells, code, status, sources, note) {
      rows.push({ symbol: ch, cells: cells, code: code, status: status, sources: sources || [], note: note || '' });
    }
    Object.keys(LETTERS).forEach(function (k) {
      row(k, [LETTERS[k]], 'UEB', 'verified-1-source', ['BRAILLE_ASCII'], 'Grade-1 letter');
    });
    Object.keys(LETTERS).forEach(function (k) {
      row(k.toUpperCase(), [CAPITAL_SIGN, LETTERS[k]], 'UEB', 'verified-1-source', ['LIBLOUIS_UEB'], 'Capital sign (dot 6) followed by the letter');
    });
    Object.keys(DIGITS).sort().forEach(function (d) {
      row(d, [LETTERS[DIGITS[d]]], 'UEB', 'unverified-existing', [], 'Digit: number sign 3-4-5-6 then the letter shown (UEB numeric rule)');
    });
    Object.keys(ENTRIES).sort().forEach(function (k) {
      var e = ENTRIES[k];
      row(k, e.cells, e.code, e.status, e.sources, e.note);
    });
    Object.keys(UNSUPPORTED).sort().forEach(function (k) {
      row(k, null, '-', 'unsupported', [], UNSUPPORTED[k]);
    });
    return rows;
  }

  return {
    getCells: getCells,
    isSupported: isSupported,
    categoryOf: categoryOf,
    describe: describe,
    referenceTable: referenceTable,
    unsupportedReason: unsupportedReason,
    UNSUPPORTED_MESSAGE: UNSUPPORTED_MESSAGE,
    SOURCES: SOURCES,
    ENTRIES: ENTRIES,
    UNSUPPORTED: UNSUPPORTED
  };
});
