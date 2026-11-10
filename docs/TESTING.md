# Testing

This file records what was run, where, and what the result was. Re-run the commands to confirm on your machine.

## Commands

```bash
# Frontend unit tests (Node built-in test runner, no network)
npm run test:unit

# Frontend browser-level tests (jsdom, local resources only)
npm install          # first time: installs jsdom
npm run test:browser

# Backend tests (requires a MongoDB or the in-memory stand-in, see below)
cd backend
pip install -r requirements-dev.txt
pytest -v
```

## Results at the time of this build

| Suite | What it covers | Result | Where it ran |
|---|---|---|---|
| `tests/frontend/braille-map.test.js` | Mapping table, multi-cell symbols, unsupported-character handling | 38 of 38 pass across the three frontend files | Linux sandbox, Node 22 |
| `tests/frontend/braille-timing.test.js` | Timing constants, per-character and whole-string estimates | included above | Linux sandbox, Node 22 |
| `tests/frontend/upi-parser.test.js` | UPI URI parsing: payee-only default, duplicates, conflicts, malformed input | included above | Linux sandbox, Node 22 |
| `tests/browser/scan-flow.test.js` | Scan-to-readout flow in jsdom with a local-only resource loader | 2 of 2 pass | Linux sandbox, jsdom 24 |
| `backend/tests/test_security_and_razorpay.py` | Lockout, demo stats auth, tz-aware datetimes, Razorpay signatures, webhook dedupe, order flow, fail-closed mode guard | 16 tests, all pass | In-memory stand-in (mongomock-motor) |
| `backend/tests/test_auth.py`, `test_users.py`, `test_banks.py`, `test_webauthn.py` | Existing auth, users, banks, WebAuthn routes | pass under the stand-in | In-memory stand-in |
| `backend/tests/test_payments.py` | Send payment, balance, idempotency, insufficient balance | **3 fail** under the stand-in (see below) | In-memory stand-in |
| `backend/tests/test_phase3.py` | Payment request pay, refund flow, notifications | **3 fail** under the stand-in (see below) | In-memory stand-in |

Backend total under the in-memory stand-in: **36 passed, 6 failed.**

## Why 6 backend tests fail here

The failures come from the test environment, not from a confirmed application bug:

- Five of them raise `NotImplementedError: Mongomock does not know how to sort ... Decimal128`. The stand-in cannot sort `Decimal128` values, and the payment engine sorts on them. Real MongoDB supports this.
- `test_refund_flow` also fails. Run alone, it fails inside the send step with the same sort error. In the full run it shows `409 == 200` on the refund. I traced the 409 to the atomic refund claim (`find_one_and_update` with `refunded: {$ne: true}`). That claim behaves correctly in the stand-in when tested in isolation, so the 409 is most likely a knock-on from the earlier failed send. This is not confirmed.

**These six tests are therefore NOT verified as passing and NOT verified as failing against a real MongoDB.** They must be run against a real MongoDB before any release.

## Running the backend against a real MongoDB

```bash
docker compose up -d mongo
cd backend
MONGO_URL=mongodb://localhost:27017 DB_NAME=braillepay_test pytest -v
```

Use a separate database name for tests so demo data is not wiped.

## The in-memory stand-in used here

The sandbox has no MongoDB server. A pytest plugin (kept outside the repo, in the build workspace) swapped the Motor client for `mongomock-motor` and ran `ensure_indexes`. It is good for the security tests and the Razorpay tests, but it does not reproduce every MongoDB behaviour, as the sort failures show.

## What has NOT been tested

- Real MongoDB, including multi-document transactions on a replica set or Atlas.
- Render deployment, cold-start behaviour, and the banner on a real free-tier wake-up.
- Vercel deployment and the CSP on the live domain.
- Real phones: Vibration API, speech output, and the scan flow with a camera. The Vibration API is not available on iOS Safari.
- WebAuthn registration and login end to end on a real device.
- Razorpay API calls. Only a fake Razorpay client was used. No credentials were available.
- Accessibility with blind or low-vision users. No user study was run.
