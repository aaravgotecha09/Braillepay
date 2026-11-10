'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../../js/braille-map.js');

test('lower-case letters are the Grade-1 alphabet, one cell each', () => {
  assert.deepEqual(B.getCells('a'), [[1]]);
  assert.deepEqual(B.getCells('j'), [[2, 4, 5]]);
  assert.deepEqual(B.getCells('z'), [[1, 3, 5, 6]]);
  for (const ch of 'abcdefghijklmnopqrstuvwxyz') {
    assert.equal(B.getCells(ch).length, 1, ch);
  }
});

test('capital letters are the UEB capital sign (dot 6) followed by the letter', () => {
  assert.deepEqual(B.getCells('A'), [[6], [1]]);
  assert.deepEqual(B.getCells('Q'), [[6], [1, 2, 3, 4, 5]]);
  for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    assert.equal(B.getCells(ch).length, 2, ch);
    assert.deepEqual(B.getCells(ch)[0], [6], ch);
  }
});

test('upper-case and lower-case are different (no silent folding)', () => {
  assert.notDeepEqual(B.getCells('q'), B.getCells('Q'));
});

test('digits use the UEB numeric rule: the letter a-j shown after the number sign', () => {
  assert.deepEqual(B.getCells('1'), [[1]]);
  assert.deepEqual(B.getCells('0'), [[2, 4, 5]]);
  for (const d of '0123456789') assert.equal(B.getCells(d).length, 1, d);
});

test('UEB symbols used by UPI IDs and payment text', () => {
  assert.deepEqual(B.getCells('@'), [[4], [1]]);            // @a
  assert.deepEqual(B.getCells('&'), [[4], [1, 2, 3, 4, 6]]); // @&
  assert.deepEqual(B.getCells('='), [[5], [2, 3, 5, 6]]);   // "7
  assert.deepEqual(B.getCells('%'), [[4, 6], [3, 5, 6]]);   // .0
  assert.deepEqual(B.getCells('_'), [[4, 6], [3, 6]]);      // .-
  assert.deepEqual(B.getCells('/'), [[4, 5, 6], [3, 4]]);   // _/
});

test('UEB brackets, braces, operators and programming symbols', () => {
  assert.deepEqual(B.getCells('('), [[5], [1, 2, 6]]);
  assert.deepEqual(B.getCells(')'), [[5], [3, 4, 5]]);
  assert.deepEqual(B.getCells('['), [[4, 6], [1, 2, 6]]);
  assert.deepEqual(B.getCells('{'), [[4, 5, 6], [1, 2, 6]]);
  assert.deepEqual(B.getCells('}'), [[4, 5, 6], [3, 4, 5]]);
  assert.deepEqual(B.getCells('\\'), [[4, 5, 6], [1, 6]]);
  assert.deepEqual(B.getCells('|'), [[4, 5, 6], [1, 2, 5, 6]]);
  assert.deepEqual(B.getCells('+'), [[5], [2, 3, 5]]);
  assert.deepEqual(B.getCells('*'), [[5], [3, 5]]);
  assert.deepEqual(B.getCells('<'), [[4], [1, 2, 6]]);
  assert.deepEqual(B.getCells('>'), [[4], [3, 4, 5]]);
  assert.deepEqual(B.getCells('~'), [[4], [3, 5]]);
  assert.deepEqual(B.getCells('^'), [[4], [2, 6]]);
  assert.deepEqual(B.getCells('`'), [[4, 6], [1, 6]]);
});

test('currency and mathematical symbols with a verified pattern', () => {
  assert.deepEqual(B.getCells('$'), [[4], [2, 3, 4]]);
  assert.deepEqual(B.getCells('€'), [[4], [1, 5]]);
  assert.deepEqual(B.getCells('£'), [[4], [1, 2, 3]]);
  assert.deepEqual(B.getCells('¢'), [[4], [1, 4]]);
  assert.deepEqual(B.getCells('÷'), [[5], [3, 4]]);
  assert.deepEqual(B.getCells('≤'), [[4, 5, 6], [4], [1, 2, 6]]);
  assert.deepEqual(B.getCells('≥'), [[4, 5, 6], [4], [3, 4, 5]]);
});

test('the number sign # uses the Braille ASCII / computer-braille pattern', () => {
  assert.deepEqual(B.getCells('#'), [[3, 4, 5, 6]]);
  assert.equal(B.ENTRIES['#'].code, 'BRAILLE-ASCII');
});

test('characters with no verified pattern are unsupported, never drawn as invented patterns', () => {
  for (const ch of ['₹', '×', '±', '≠', 'ह', '漢', '😀']) {
    assert.equal(B.getCells(ch), null, ch);
    assert.equal(B.isSupported(ch), false, ch);
    assert.ok(B.unsupportedReason(ch).length > 0, ch);
  }
});

test('every printable ASCII character is either mapped or listed as unsupported (no gaps)', () => {
  for (let code = 0x21; code <= 0x7e; code++) {
    const ch = String.fromCharCode(code);
    const supported = B.getCells(ch) !== null;
    assert.ok(supported || B.unsupportedReason(ch) !== '', `unaccounted character ${ch} (U+${code.toString(16)})`);
  }
});

test('every symbol entry records its code, status and sources, and the sources exist', () => {
  for (const [sym, entry] of Object.entries(B.ENTRIES)) {
    assert.ok(['UEB', 'BRAILLE-ASCII'].includes(entry.code), `${sym} code`);
    assert.ok(['verified-2-sources', 'verified-1-source', 'unverified-existing'].includes(entry.status), `${sym} status`);
    for (const id of entry.sources) assert.ok(B.SOURCES[id], `${sym} cites unknown source ${id}`);
    if (entry.status === 'verified-2-sources') assert.ok(entry.sources.length >= 2, `${sym} needs two sources`);
    if (entry.status === 'verified-1-source') assert.ok(entry.sources.length >= 1, `${sym} needs a source`);
  }
});

test('all dot numbers are integers 1-6 and every cell is non-empty', () => {
  for (const row of B.referenceTable()) {
    if (!row.cells) continue;
    for (const cell of row.cells) {
      assert.ok(cell.length >= 1, row.symbol);
      for (const d of cell) assert.ok(Number.isInteger(d) && d >= 1 && d <= 6, `${row.symbol}: ${d}`);
    }
  }
});

test('mixed UPI-style string: every character is supported', () => {
  const report = B.describe('Rahul.Sharma_42@ybl');
  assert.ok(report.every(r => r.supported));
  assert.equal(report.find(r => r.char === '@').cells.length, 2);
  assert.equal(report.find(r => r.char === 'R').cells.length, 2);   // capital sign + r
  assert.equal(report.find(r => r.char === '4').category, 'digit');
});

test('space and categories', () => {
  assert.equal(B.categoryOf(' '), 'space');
  assert.equal(B.categoryOf('a'), 'letter');
  assert.equal(B.categoryOf('7'), 'digit');
  assert.equal(B.categoryOf('@'), 'symbol');
});
