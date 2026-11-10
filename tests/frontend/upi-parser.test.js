'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('../../js/upi-parser.js');

const parse = U.parseUpiUri;

test('standard UPI deep link: all fields read', () => {
  const r = parse('upi://pay?pa=merchant@upi&pn=Store&am=500&cu=INR&tn=Payment');
  assert.equal(r.ok, true);
  assert.equal(r.kind, 'upi_uri');
  assert.equal(r.vpa, 'merchant@upi');
  assert.equal(r.payeeName, 'Store');
  assert.equal(r.amount, 500);
  assert.equal(r.currency, 'INR');
  assert.equal(r.note, 'Payment');
  assert.deepEqual(r.warnings, []);
});

test('only pa is required: a payment with pa alone is accepted with null optional fields', () => {
  const r = parse('upi://pay?pa=shop@ybl');
  assert.equal(r.ok, true);
  assert.equal(r.amount, null);
  assert.equal(r.payeeName, null);
  assert.equal(r.note, null);
  assert.equal(r.currency, 'INR');
});

test('scheme and action are case-insensitive', () => {
  const r = parse('UPI://PAY?PA=shop@ybl&AM=20');
  assert.equal(r.ok, true);
  assert.equal(r.vpa, 'shop@ybl');
  assert.equal(r.amount, 20);
});

test('missing pa is rejected with a clear error', () => {
  const r = parse('upi://pay?pn=Store&am=500');
  assert.equal(r.ok, false);
  assert.equal(r.error, 'missing_pa');
});

test('empty pa value counts as missing', () => {
  assert.equal(parse('upi://pay?pa=&pn=Store').error, 'missing_pa');
});

test('conflicting payee IDs are rejected (never guess which person to pay)', () => {
  const r = parse('upi://pay?pa=a@upi&pa=b@upi');
  assert.equal(r.ok, false);
  assert.equal(r.error, 'conflicting_pa');
});

test('identical duplicate pa is accepted with a warning', () => {
  const r = parse('upi://pay?pa=shop@upi&pa=shop@upi');
  assert.equal(r.ok, true);
  assert.ok(r.warnings.includes('duplicate_pa'));
});

test('invalid UPI ID (space, no domain, symbols) is rejected', () => {
  assert.equal(parse('upi://pay?pa=bad%20id@upi').error, 'invalid_vpa');
  assert.equal(parse('upi://pay?pa=nodomain').error, 'invalid_vpa');
  assert.equal(parse('upi://pay?pa=a+b@upi').error, 'invalid_vpa');
});

test('invalid amounts are not read as money and are flagged', () => {
  for (const am of ['-5', 'abc', '1.234', '0', '1e3', '99999999999']) {
    const r = parse(`upi://pay?pa=shop@ybl&am=${am}`);
    assert.equal(r.ok, true, am);
    assert.equal(r.amount, null, am);
    assert.ok(r.warnings.includes('invalid_amount'), am);
  }
});

test('valid decimal amounts with up to two places', () => {
  assert.equal(parse('upi://pay?pa=shop@ybl&am=500.5').amount, 500.5);
  assert.equal(parse('upi://pay?pa=shop@ybl&am=12.34').amount, 12.34);
});

test('URL-encoded and form-encoded names are decoded', () => {
  assert.equal(parse('upi://pay?pa=rahul@ybl&pn=Rahul%20Sharma').payeeName, 'Rahul Sharma');
  assert.equal(parse('upi://pay?pa=rahul@ybl&pn=Rahul+Sharma').payeeName, 'Rahul Sharma');
  assert.equal(parse('upi://pay?pa=rahul@ybl&tn=Caf%C3%A9').note, 'Café');
});

test('malformed percent-encoding is reported, not silently mangled', () => {
  const r = parse('upi://pay?pa=shop@ybl&pn=%zz');
  assert.equal(r.ok, false);
  assert.equal(r.error, 'malformed_encoding');
});

test('control characters are stripped from names and notes', () => {
  const r = parse('upi://pay?pa=shop@ybl&pn=Shop%00%07Name');
  assert.equal(r.payeeName, 'ShopName');
});

test('non-UPI QR codes are not treated as payments', () => {
  for (const text of ['https://example.com/pay', 'A1B2C3', 'WELCOME 42', '{"type":"x"}']) {
    const r = parse(text);
    assert.equal(r.ok, false, text);
    assert.equal(r.error, 'unsupported_format', text);
  }
});

test('other upi:// actions are not payments', () => {
  const r = parse('upi://mandate?pa=shop@ybl');
  assert.equal(r.ok, false);
  assert.equal(r.error, 'unsupported_action');
});

test('a QR that is only a VPA is an identity, not a payment request', () => {
  const r = parse('rahul123@ybl');
  assert.equal(r.ok, true);
  assert.equal(r.kind, 'bare_vpa');
  assert.equal(r.vpa, 'rahul123@ybl');
});

test('empty, non-string and oversized input are rejected', () => {
  assert.equal(parse('   ').error, 'empty');
  assert.equal(parse(null).error, 'not_text');
  assert.equal(parse('upi://pay?pa=a@ybl&' + 'x=1&'.repeat(1000)).error, 'too_long');
});

test('non-INR currency is flagged', () => {
  const r = parse('upi://pay?pa=shop@ybl&cu=USD');
  assert.equal(r.ok, true);
  assert.ok(r.warnings.includes('unsupported_currency'));
});

test('unknown parameters are ignored and noted', () => {
  const r = parse('upi://pay?pa=shop@ybl&zz=1');
  assert.ok(r.warnings.includes('ignored_parameters'));
});

test('optionalFields lists the fields in order with nulls for absent ones', () => {
  const fields = U.optionalFields(parse('upi://pay?pa=shop@ybl&am=20'));
  assert.deepEqual(fields.map(f => f.id), ['upi', 'name', 'amount', 'note']);
  assert.equal(fields[0].value, 'shop@ybl');
  assert.equal(fields[1].value, null);
  assert.equal(fields[2].value, '20');
  assert.deepEqual(U.optionalFields({ ok: false }), []);
});
