/*
 * Playback timing for BraillePay's haptic/audio Braille engine.
 *
 * TIMING is the single source of truth for pacing (the browser engine in
 * js/app.js reads it from here). estimateMs() mirrors the control flow of
 * playOneCharacter() / createSequencePlayer() in js/app.js so that the
 * playback-time figures quoted in the docs are computed from the same
 * constants the app really uses, not typed in by hand.
 *
 * All values are milliseconds at 1x playback speed.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.BraillePayTiming = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  var TIMING = {
    beforeChar: 1000,     // silence before a character starts
    dotVibration: 350,    // how long each raised dot buzzes (also the length of a silent slot)
    dotGap: 700,          // silence between two dot slots inside one cell
    afterLastDot: 1500,   // silence after the last dot of the last cell
    beforeNextChar: 2000, // silence before starting the next character
    spacePulse: 550,      // single distinguishing pulse used to mark a space
    numberSignBuzz: 160,  // each of the two short buzzes in the "digit" cue
    numberSignGap: 130,   // gap between those two buzzes
    afterNumberSign: 650, // pause after the number-sign cue, before a digit's own dots
    cellGap: 1000         // NEW: silence between two cells of the same multi-cell symbol
  };

  var SLOTS_PER_CELL = 6;

  /**
   * Duration in ms (at 1x) of one character.
   * @param {string} ch           the character
   * @param {number} cellCount    number of cells the character is written with (1 for unsupported)
   * @param {string} category     'letter' | 'digit' | 'space' | 'symbol'
   */
  function charMs(category, cellCount, T) {
    T = T || TIMING;
    var ms = T.beforeChar;
    if (category === 'digit') {
      ms += T.numberSignBuzz * 2 + T.numberSignGap + T.afterNumberSign;
    }
    if (category === 'space') {
      ms += T.spacePulse;
    } else {
      var perCell = SLOTS_PER_CELL * T.dotVibration + (SLOTS_PER_CELL - 1) * T.dotGap;
      ms += cellCount * perCell + Math.max(0, cellCount - 1) * T.cellGap;
    }
    ms += T.afterLastDot + T.beforeNextChar;
    return ms;
  }

  /**
   * Estimated total playback time for a sequence of characters.
   * cellsFor(ch) must return the cell list (or null if unsupported) — pass
   * BraillePayBraille.getCells for the real mapping.
   */
  function estimateMs(text, rate, cellsFor, categoryFor) {
    var r = rate || 1;
    var total = 0;
    Array.prototype.forEach.call(String(text || ''), function (ch) {
      var category = categoryFor(ch);
      var cells = category === 'space' ? [] : (cellsFor(ch) || [[1, 2, 3, 4, 5, 6]]);
      total += charMs(category, Math.max(1, cells.length), TIMING);
    });
    return total / r;
  }

  return { TIMING: TIMING, charMs: charMs, estimateMs: estimateMs, SLOTS_PER_CELL: SLOTS_PER_CELL };
});
