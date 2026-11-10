/*
 * UPI QR payload parsing for BraillePay.
 *
 * Input: the decoded text of a QR code.
 * Output: a result object. Nothing is inferred or invented:
 *   { ok: true,  kind: 'upi_uri',  vpa, payeeName, amount, currency, note, reference, warnings }
 *   { ok: true,  kind: 'bare_vpa', vpa, ... }            (QR contains only "name@bank")
 *   { ok: false, error: '<code>', message: '<text>' }     (not a UPI payment, or unusable)
 *
 * Only `pa` (payee VPA) is required. Everything else is optional and is only
 * read aloud when the user asks for it. This module never starts a payment.
 *
 * Standard reference used: NPCI "UPI Linking Specification" deep-link format
 * upi://pay?pa=<VPA>&pn=<name>&am=<amount>&cu=<currency>&tn=<note>&tr=<reference>.
 * Re-check against the current NPCI specification before production use.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.BraillePayUPI = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  var MAX_INPUT_LENGTH = 2048;
  var MAX_NAME_LENGTH = 100;
  var MAX_NOTE_LENGTH = 200;
  var VPA_RE = /^[A-Za-z0-9._-]{2,64}@[A-Za-z]{2,64}$/;
  var AMOUNT_RE = /^(0|[1-9][0-9]{0,8})(\.[0-9]{1,2})?$/;
  var CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]/g;
  var KNOWN_PARAMS = ['pa', 'pn', 'am', 'cu', 'tn', 'tr', 'tid', 'mc', 'mode', 'orgid', 'sign'];

  function fail(error, message) {
    return { ok: false, error: error, message: message };
  }

  /**
   * Decode one query component. "+" means space (form encoding), and %XX is
   * percent-decoded. A malformed escape (e.g. "%zz") is reported, not ignored.
   */
  function decodeComponent(raw) {
    var withSpaces = raw.replace(/\+/g, ' ');
    try {
      return { value: decodeURIComponent(withSpaces) };
    } catch (e) {
      return { error: true };
    }
  }

  /** Splits "a=1&b=2" into { a: ['1'], b: ['2'] }; returns { error } on bad encoding. */
  function parseQuery(query) {
    var params = {};
    var parts = query.split('&');
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (part === '') { continue; }
      var eq = part.indexOf('=');
      var rawKey = eq === -1 ? part : part.slice(0, eq);
      var rawVal = eq === -1 ? '' : part.slice(eq + 1);
      var k = decodeComponent(rawKey);
      var v = decodeComponent(rawVal);
      if (k.error || v.error) { return { error: true }; }
      var key = k.value.trim().toLowerCase();
      if (key === '') { continue; }
      if (!params[key]) { params[key] = []; }
      params[key].push(v.value);
    }
    return { params: params };
  }

  function cleanText(value, maxLen) {
    return String(value).replace(CONTROL_CHARS_RE, '').trim().slice(0, maxLen);
  }

  /** Picks one value for a field. Conflicting duplicates are an error only for `pa`. */
  function pickField(params, key, warnings) {
    var values = (params[key] || []).map(function (v) { return v.trim(); }).filter(function (v) { return v !== ''; });
    if (values.length === 0) { return null; }
    var distinct = values.filter(function (v, i) { return values.indexOf(v) === i; });
    if (distinct.length > 1) {
      warnings.push('duplicate_' + key);
    }
    return values[0];
  }

  /**
   * Parses decoded QR text. Never throws.
   * @param {string} text
   */
  function parseUpiUri(text) {
    if (typeof text !== 'string') { return fail('not_text', 'The QR code did not decode to text.'); }
    var trimmed = text.trim();
    if (trimmed === '') { return fail('empty', 'The QR code is empty.'); }
    if (trimmed.length > MAX_INPUT_LENGTH) { return fail('too_long', 'The QR code content is too long to be a UPI payment.'); }

    // A QR that is only a VPA, e.g. "rahul123@ybl". Treated as an identity, not a payment request.
    if (VPA_RE.test(trimmed)) {
      return { ok: true, kind: 'bare_vpa', vpa: trimmed, payeeName: null, amount: null, currency: 'INR', note: null, reference: null, warnings: [] };
    }

    var schemeMatch = /^upi:\/\/([a-z]+)\?/i.exec(trimmed);
    if (!schemeMatch) {
      return fail('unsupported_format', 'This QR code is not a UPI payment code, so BraillePay will not read its payment details.');
    }
    if (schemeMatch[1].toLowerCase() !== 'pay') {
      return fail('unsupported_action', 'This UPI code is not a payment request (upi://' + schemeMatch[1] + ').');
    }

    var query = trimmed.slice(trimmed.indexOf('?') + 1);
    var parsed = parseQuery(query);
    if (parsed.error) {
      return fail('malformed_encoding', 'The QR code contains a broken URL-encoded value, so it was not read.');
    }
    var params = parsed.params;
    var warnings = [];

    // pa: the only required field. Conflicting payee IDs are rejected outright.
    var paValues = (params.pa || []).map(function (v) { return v.trim(); }).filter(function (v) { return v !== ''; });
    if (paValues.length === 0) {
      return fail('missing_pa', 'The UPI code has no payee ID (pa), so it cannot be read.');
    }
    if (paValues.some(function (v) { return v !== paValues[0]; })) {
      return fail('conflicting_pa', 'The UPI code lists more than one payee ID. It was not read to avoid paying the wrong person.');
    }
    var vpa = paValues[0];
    if (!VPA_RE.test(vpa)) {
      return fail('invalid_vpa', 'The payee ID in this UPI code is not valid.');
    }
    if (paValues.length > 1) { warnings.push('duplicate_pa'); }

    var name = pickField(params, 'pn', warnings);
    name = name === null ? null : cleanText(name, MAX_NAME_LENGTH);

    var amount = null;
    var amountRaw = pickField(params, 'am', warnings);
    if (amountRaw !== null) {
      if (AMOUNT_RE.test(amountRaw) && Number(amountRaw) > 0) {
        amount = Number(amountRaw);
      } else {
        warnings.push('invalid_amount');
      }
    }

    var currency = pickField(params, 'cu', warnings) || 'INR';
    currency = currency.toUpperCase();
    if (currency !== 'INR') { warnings.push('unsupported_currency'); }

    var note = pickField(params, 'tn', warnings);
    note = note === null ? null : cleanText(note, MAX_NOTE_LENGTH);

    var reference = pickField(params, 'tr', warnings) || pickField(params, 'tid', warnings);
    reference = reference === null ? null : cleanText(reference, 64);

    var unknown = Object.keys(params).filter(function (k) { return KNOWN_PARAMS.indexOf(k) === -1; });
    if (unknown.length) { warnings.push('ignored_parameters'); }

    return {
      ok: true,
      kind: 'upi_uri',
      vpa: vpa,
      payeeName: name,
      amount: amount,
      currency: currency,
      note: note,
      reference: reference,
      warnings: warnings
    };
  }

  /**
   * The fields a user can choose to hear, in order. Only "upi" is read by default.
   * Returns [{ id, label, value }] with value null where the field is absent.
   */
  function optionalFields(parsed) {
    if (!parsed || !parsed.ok) { return []; }
    return [
      { id: 'upi', label: 'UPI ID', value: parsed.vpa },
      { id: 'name', label: 'Payee name', value: parsed.payeeName },
      { id: 'amount', label: 'Amount', value: parsed.amount === null ? null : String(parsed.amount) },
      { id: 'note', label: 'Note', value: parsed.note }
    ];
  }

  return {
    parseUpiUri: parseUpiUri,
    optionalFields: optionalFields,
    VPA_RE: VPA_RE,
    MAX_INPUT_LENGTH: MAX_INPUT_LENGTH
  };
});
