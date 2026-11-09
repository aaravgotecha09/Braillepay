'use strict';
/*
 * Browser-level test of the scan flow, run in jsdom (a browser-like DOM).
 * Setup: npm install      (jsdom is a dev dependency)
 * Run:   npm run test:browser
 *
 * Loads the real index.html and its scripts from disk and triggers the demo scan. External
 * resources (Google Fonts) are not fetched. Network calls to the backend are recorded and rejected.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { JSDOM, VirtualConsole, ResourceLoader } = require('jsdom');

const APP_DIR = path.resolve(__dirname, '..', '..');
const wait = ms => new Promise(r => setTimeout(r, ms));

/** Serves local files only; everything else (fonts, CDNs) resolves empty. */
class LocalOnlyLoader extends ResourceLoader {
  fetch(url, options) {
    if (String(url).startsWith('file:')) return super.fetch(url, options);
    return Promise.resolve(Buffer.from(''));
  }
}

async function loadApp({ randomIndex }) {
  const requests = [];
  const errors = [];
  const vc = new VirtualConsole();
  // jsdom has no <canvas> implementation (the optional 'canvas' package is not installed). The app's
  // scanner draws camera frames to a canvas, so that one message is expected here and nothing else is.
  vc.on('jsdomError', e => {
    const msg = String(e.message || e);
    if (!/HTMLCanvasElement\.prototype\.getContext/.test(msg)) errors.push(msg);
  });
  const dom = await JSDOM.fromFile(path.join(APP_DIR, 'index.html'), {
    runScripts: 'dangerously',
    resources: new LocalOnlyLoader(),
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.navigator.vibrate = () => true;
      window.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 16);
      window.scrollTo = () => {};
      window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      window.Math.random = () => randomIndex; // pin the demo sample
      window.fetch = (url, init) => {
        requests.push({ url: String(url), method: (init && init.method) || 'GET' });
        return Promise.reject(new TypeError('network disabled in test'));
      };
    }
  });
  await wait(300);
  return { dom, window: dom.window, document: dom.window.document, requests, errors };
}

test('UPI demo code: payee ID is read first; other fields only on request; no payment call', async () => {
  const app = await loadApp({ randomIndex: 0.99 }); // last demo sample = the UPI deep link
  try {
    const { document, requests, errors } = app;
    document.getElementById('btn-try-demo-scan').click();
    await wait(5200); // lock (550 ms) + verification steps (~4 s)

    assert.equal(document.getElementById('scan-player').hidden, false, 'player visible');
    assert.equal(document.getElementById('upi-field-controls').hidden, false, 'UPI controls visible');
    assert.equal(document.getElementById('scan-progress-label').textContent, 'Character 1 of 12', 'reads rahul123@ybl, not the URL');
    assert.equal(document.querySelector('[data-upi-field="amount"]').disabled, false, 'amount available');
    assert.equal(document.querySelector('[data-upi-field="name"]').disabled, false, 'payee name available');

    document.querySelector('[data-upi-field="amount"]').click();
    await wait(200);
    assert.equal(document.getElementById('scan-progress-label').textContent, 'Character 1 of 3', 'amount 250 read on request');

    assert.equal(requests.filter(r => /\/api\/payments/.test(r.url)).length, 0, 'scanning never calls the payments API');
    assert.deepEqual(errors, [], 'no uncaught script errors');
  } finally {
    app.window.close();
  }
});

test('plain (non-UPI) demo code still reads the whole decoded text, as before', async () => {
  const app = await loadApp({ randomIndex: 0.0 }); // 'A1B2C3'
  try {
    const { document } = app;
    document.getElementById('btn-try-demo-scan').click();
    await wait(5200);
    assert.equal(document.getElementById('scan-player').hidden, false);
    assert.equal(document.getElementById('scan-progress-label').textContent, 'Character 1 of 6');
    assert.equal(document.getElementById('upi-field-controls').hidden, true);
  } finally {
    app.window.close();
  }
});
