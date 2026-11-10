'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../../js/braille-map.js');
const T = require('../../js/braille-timing.js');

const cellsFor = B.getCells;
const catFor = B.categoryOf;

test('timing constants keep the original pacing values', () => {
  const x = T.TIMING;
  assert.equal(x.beforeChar, 1000);
  assert.equal(x.dotVibration, 350);
  assert.equal(x.dotGap, 700);
  assert.equal(x.afterLastDot, 1500);
  assert.equal(x.beforeNextChar, 2000);
  assert.equal(x.cellGap, 1000); // new: between cells of a multi-cell symbol
});

test('one single-cell letter takes 10.1 s at 1x (matches the original engine)', () => {
  assert.equal(T.charMs('letter', 1), 10100);
  assert.equal(T.estimateMs('a', 1, cellsFor, catFor), 10100);
  // A capital letter is two cells (capital sign + letter), so it takes longer.
  assert.equal(T.estimateMs('A', 1, cellsFor, catFor), 16700);
});

test('one letter at 1.4x takes about 7.2 s', () => {
  const ms = T.estimateMs('a', 1.4, cellsFor, catFor);
  assert.ok(Math.abs(ms - 7214.2857) < 0.01, ms);
});

test('digits add the number-sign cue (11.2 s at 1x)', () => {
  assert.equal(T.charMs('digit', 1), 11200);
});

test('space takes 5.05 s at 1x', () => {
  assert.equal(T.charMs('space', 0), 5050);
});

test('a two-cell UEB symbol takes 16.7 s at 1x', () => {
  assert.equal(T.charMs('symbol', 2), 16700);
});

test('12-character UPI ID "merchant@upi" at 1x and 1.4x', () => {
  const id = 'merchant@upi';
  assert.equal(id.length, 12);
  assert.equal(T.estimateMs(id, 1, cellsFor, catFor), 127800);
  assert.ok(Math.abs(T.estimateMs(id, 1.4, cellsFor, catFor) - 91285.714) < 0.01);
});

test('estimate scales inversely with playback rate', () => {
  const a = T.estimateMs('HELLO', 1, cellsFor, catFor);
  const b = T.estimateMs('HELLO', 2, cellsFor, catFor);
  assert.ok(Math.abs(a / 2 - b) < 1e-6);
});

test('the whole decoded URL is far slower than the UPI ID alone', () => {
  const url = 'upi://pay?pa=merchant@upi&pn=Store&am=500&cu=INR&tn=Payment';
  const idOnly = 'merchant@upi';
  const urlMs = T.estimateMs(url, 1.4, cellsFor, catFor);
  const idMs = T.estimateMs(idOnly, 1.4, cellsFor, catFor);
  assert.ok(urlMs > idMs * 4, `${urlMs} vs ${idMs}`);
});
