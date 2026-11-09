/*
 * BraillePay Braille mapping table.
 *
 * Every entry is a list of CELLS. A cell is an array of raised dot numbers
 * (1-6, standard 6-dot numbering). Most characters are one cell. Some symbols
 * are two cells in Unified English Braille (UEB), so they are represented as
 * two entries in the list.
 *
 * Letters, digits and punctuation below are the original Grade-1 table and
 * are unchanged. The symbols @ & = % _ / were previously missing (they fell
 * back to a full cell); see docs/BRAILLE_MAPPING.md for the source and the
 * verification status of each entry.
 *
 * Loaded as a plain <script> in the browser (exposes window.BraillePayBraille)
 * and as a CommonJS module under Node (used by tests/frontend).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.BraillePayBraille = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  /* Single-cell table (original, unchanged). */
  var SINGLE_CELL = {
    'A':[1],'B':[1,2],'C':[1,4],'D':[1,4,5],'E':[1,5],'F':[1,2,4],'G':[1,2,4,5],
    'H':[1,2,5],'I':[2,4],'J':[2,4,5],'K':[1,3],'L':[1,2,3],'M':[1,3,4],'N':[1,3,4,5],
    'O':[1,3,5],'P':[1,2,3,4],'Q':[1,2,3,4,5],'R':[1,2,3,5],'S':[2,3,4],'T':[2,3,4,5],
    'U':[1,3,6],'V':[1,2,3,6],'W':[2,4,5,6],'X':[1,3,4,6],'Y':[1,3,4,5,6],'Z':[1,3,5,6],
    '1':[1],'2':[1,2],'3':[1,4],'4':[1,4,5],'5':[1,5],'6':[1,2,4],'7':[1,2,4,5],
    '8':[1,2,5],'9':[2,4],'0':[2,4,5],
    '.':[2,5,6], ',':[2], '?':[2,3,6], '!':[2,3,5], ';':[2,3], ':':[2,5], '-':[3,6], "'":[3]
  };

  /*
   * Multi-cell symbols needed for UPI IDs (and payee names / notes).
   * Each value is the ordered list of cells the symbol is written as in
   * Unified English Braille. "ueb" is the UEB construction used in the
   * Rulebook / BANA-ICEB tables; "status" records how well it is verified.
   *
   *   'verified-2-sources'  two or more independent sources agree
   *   'verified-1-source'   one authoritative-looking source; re-check against
   *                        the ICEB Rules of UEB before relying on it
   */
  var MULTI_CELL = {
    '@': { cells: [[4],[1]],         ueb: '@a  (at sign)',       status: 'verified-2-sources' },
    '&': { cells: [[4],[1,2,3,4,6]], ueb: '@&  (ampersand)',     status: 'verified-2-sources' },
    '=': { cells: [[5],[2,3,5,6]],   ueb: '"7  (equals)',        status: 'verified-2-sources' },
    '%': { cells: [[4,6],[3,5,6]],   ueb: '.0  (percent)',       status: 'verified-2-sources' },
    '_': { cells: [[4,6],[3,6]],     ueb: '.-  (low line)',      status: 'verified-1-source' },
    '/': { cells: [[4,5,6],[3,4]],   ueb: '_/  (forward slash)', status: 'verified-1-source' }
  };

  /* Characters that are deliberately UNSUPPORTED: they are announced, not silently drawn. */
  var UNSUPPORTED_MESSAGE = 'No Braille mapping for this character — shown as a full cell and announced as unsupported.';

  function normalise(ch) {
    return (ch === undefined || ch === null) ? '' : String(ch).toUpperCase();
  }

  /**
   * Returns the list of cells for a single character, or null if the character
   * has no mapping. Whitespace is handled by the caller (it has no cells).
   */
  function getCells(ch) {
    var key = normalise(ch);
    if (key.length !== 1) { return null; }
    if (Object.prototype.hasOwnProperty.call(SINGLE_CELL, key)) { return [SINGLE_CELL[key].slice()]; }
    if (Object.prototype.hasOwnProperty.call(MULTI_CELL, key)) {
      return MULTI_CELL[key].cells.map(function (c) { return c.slice(); });
    }
    return null;
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

  /**
   * Full mapping report for a string: one entry per character with its cells
   * and whether it is supported. Used by tests and by the mapping reference.
   */
  function describe(text) {
    return Array.prototype.map.call(String(text || ''), function (ch) {
      var cells = getCells(ch);
      return { char: ch, category: categoryOf(ch), supported: cells !== null || ch === ' ', cells: cells };
    });
  }

  /** Documentation rows for docs/BRAILLE_MAPPING.md (generated, not hand-typed). */
  function referenceTable() {
    var rows = [];
    Object.keys(SINGLE_CELL).sort().forEach(function (k) {
      rows.push({ symbol: k, cells: [SINGLE_CELL[k]], standard: 'Grade-1 (unchanged)', status: 'original' });
    });
    Object.keys(MULTI_CELL).forEach(function (k) {
      rows.push({ symbol: k, cells: MULTI_CELL[k].cells, standard: 'UEB: ' + MULTI_CELL[k].ueb, status: MULTI_CELL[k].status });
    });
    return rows;
  }

  return {
    getCells: getCells,
    isSupported: isSupported,
    categoryOf: categoryOf,
    describe: describe,
    referenceTable: referenceTable,
    UNSUPPORTED_MESSAGE: UNSUPPORTED_MESSAGE,
    SINGLE_CELL: SINGLE_CELL,
    MULTI_CELL: MULTI_CELL
  };
});
