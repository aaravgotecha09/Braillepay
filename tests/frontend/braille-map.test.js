'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../../js/braille-map.js');

test('original Grade-1 letters and digits are unchanged', () => {
  assert.deepEqual(B.getCells('A'), [[1]]);
  assert.deepEqual(B.getCells('B'), [[1, 2]]);
  assert.deepEqual(B.getCells('Z'), [[1, 3, 5, 6]]);
  assert.deepEqual(B.getCells('0'), [[2, 4, 5]]);
  assert.deepEqual(B.getCells('9'), [[2, 4]]);
  assert.deepEqual(B.getCells('.'), [[2, 5, 6]]);
  assert.deepEqual(B.getCells('-'), [[3, 6]]);
});

test('every letter and digit is supported with exactly one cell', () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
  for (const ch of chars) {
    const cells = B.getCells(ch);
    assert.ok(cells, `missing mapping for ${ch}`);
    assert.equal(cells.length, 1, `${ch} should be one cell`);
  }
});

test('lower-case input maps to the same cells as upper-case', () => {
  assert.deepEqual(B.getCells('q'), B.getCells('Q'));
});

test('UEB symbols needed for UPI IDs are two-cell mappings (UEB construction)', () => {
  assert.deepEqual(B.getCells('@'), [[4], [1]]);          // @a  (at sign)
  assert.deepEqual(B.getCells('&'), [[4], [1, 2, 3, 4, 6]]); // @&  (ampersand)
  assert.deepEqual(B.getCells('='), [[5], [2, 3, 5, 6]]);  // "7  (equals)
  assert.deepEqual(B.getCells('%'), [[4, 6], [3, 5, 6]]);  // .0  (percent)
  assert.deepEqual(B.getCells('_'), [[4, 6], [3, 6]]);     // .-  (low line)
  assert.deepEqual(B.getCells('/'), [[4, 5, 6], [3, 4]]);  // _/  (forward slash)
});

test('every multi-cell symbol records its UEB notation and a verification status', () => {
  for (const [sym, entry] of Object.entries(B.MULTI_CELL)) {
    assert.ok(entry.cells.length >= 2, `${sym} should be multi-cell`);
    assert.ok(entry.ueb && entry.ueb.length > 0, `${sym} needs a UEB notation`);
    assert.ok(['verified-2-sources', 'verified-1-source'].includes(entry.status), `${sym} status`);
  }
});

test('all dot numbers are in the range 1-6 and cells are non-empty', () => {
  for (const row of B.referenceTable()) {
    assert.ok(row.cells.length >= 1, row.symbol);
    for (const cell of row.cells) {
      assert.ok(cell.length >= 1, row.symbol);
      for (const d of cell) assert.ok(d >= 1 && d <= 6 && Number.isInteger(d), `${row.symbol}: ${d}`);
    }
  }
});

test('characters without a documented mapping are reported as unsupported', () => {
  for (const ch of ['#', '*', '€', 'ह', '~', '+', '"']) {
    assert.equal(B.getCells(ch), null, ch);
    assert.equal(B.isSupported(ch), false, ch);
  }
});

test('mixed UPI-style string: every character is either supported or flagged', () => {
  const report = B.describe('rahul.sharma_42@ybl');
  assert.equal(report.length, 'rahul.sharma_42@ybl'.length);
  assert.ok(report.every(r => r.supported));
  assert.equal(report.find(r => r.char === '@').cells.length, 2);
  assert.equal(report.find(r => r.char === '4').category, 'digit');
});

test('space and categories', () => {
  assert.equal(B.categoryOf(' '), 'space');
  assert.equal(B.categoryOf('a'), 'letter');
  assert.equal(B.categoryOf('7'), 'digit');
  assert.equal(B.categoryOf('@'), 'symbol');
});
