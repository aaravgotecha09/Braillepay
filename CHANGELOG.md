# Changelog

## Unreleased: hardening, QR/UPI reading, Razorpay test mode, PWA

### Scanner and accessibility (frontend)
- QR codes that are UPI links now read **only the payee UPI ID** by default. Name, amount and note are available through separate controls.
- Rejects UPI links that are malformed, have conflicting payee IDs, use an unsupported action or currency, or have an invalid VPA. These are not read aloud.
- Braille mappings added for `@ & = % _ /` as two-cell UEB constructions. Characters with no mapping are announced as "Unsupported symbol" and drawn as a full cell with a caption.
- Playback timing constants moved to `js/braille-timing.js`. A per-cell gap of 1 s separates the cells of multi-cell symbols.
- A **Render cold-start banner** with exponential backoff (1, 2, 4, 8, 15 s) and a manual **Retry now** button. `/health` is separate from payment confirmation.
- API requests use a 15 s timeout. Only GET requests are retried. Writes are never retried automatically.
- A network failure during a payment is reported as **"Payment status unknown"**, not "Payment failed".
- The idempotency key is regenerated when the recipient, amount or note changes.
- The history entry for a scan is a deterministic `read`, replacing a random status.
- `unsupported` added to the English UI strings.

### Frontend platform
- jsQR is vendored at `vendor/jsQR.js` (Apache-2.0, licence included). The CDN script is removed.
- The inline script is moved to `js/app.js`, so the CSP can use `script-src 'self'`.
- `vercel.json` sets HSTS, nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, COOP, and a CSP with `frame-ancestors 'none'`.
- `config.js` selects the API base URL by hostname. It holds no secrets.
- PWA: `manifest.json`, `service-worker.js` (static shell only, never caches `/api/`, `/health` or cross-origin requests), `offline.html` (says offline never implies a payment succeeded), and generated icons.

### Backend security and correctness
- Login enforces the existing lockout (`raise_if_locked`, failed-attempt counting, reset on success).
- `GET /api/demo/stats` requires authentication and returns only the caller's recent transactions.
- The Motor client is created with `tz_aware=True`. `as_utc` normalises datetimes in lockout, WebAuthn challenge expiry and payment-request expiry. This fixes a `TypeError` in those comparisons.
- `payment_orders` and `webhook_events` collections, with unique indexes.

### Razorpay (backend, test mode)
- Order creation, order read, checkout-signature verification, and a webhook endpoint with raw-body signature checks and event de-duplication.
- Fail-closed mode guard. Live mode is refused unless `RAZORPAY_MODE=live`, `RAZORPAY_LIVE_APPROVED=true` and an `rzp_live_` key are all present.
- Razorpay routes return 503 when not configured. They never fall back to a simulated payment.
- Razorpay payments do not change the demo ledger.
- No frontend Checkout yet. Not tested against the live Razorpay API.

### Tests and tooling
- `package.json` with `test:unit`, `test:browser`, `serve`.
- 38 frontend unit tests (all pass), 2 jsdom browser tests (both pass).
- 16 backend tests for security and Razorpay (pass under an in-memory stand-in).
- Updated `test_phase3.py::test_demo_stats` for the authenticated contract.
- Fixed an insufficient-balance test whose amount was above the demo ceiling.
- `tools/generate_docs.js` regenerates `docs/BRAILLE_MAPPING.md` and `docs/TECHNICAL_CALCULATIONS.md` from the code.

### Deployment and documentation
- `render.yaml` (Blueprint). Secrets use `sync: false` or `generateValue`. No secret values are stored.
- `env.example`, `backend/.env.example` (placeholders only), `.gitignore`.
- `docs/DEPLOYMENT.md`, `docs/SECURITY_AUDIT.md`, `docs/TESTING.md`, `docs/RAZORPAY.md`, `docs/P2P_AND_COMPLIANCE.md`, `docs/BRAILLE_MAPPING.md`, `docs/TECHNICAL_CALCULATIONS.md`.

### Known gaps
- Six existing payment-engine tests cannot run under the in-memory stand-in. They need a real MongoDB.
- Not verified on real devices, with a real MongoDB, on the live deployments, or with Razorpay credentials.
- The braille mappings for `_` and `/` rest on a single source. The `@ & = %` labels are unconfirmed (see `docs/BRAILLE_MAPPING.md`).
- No user study. No usability or accuracy claims are made.
- Not included in this build: the research evidence document, the IEEE-style paper, and the corrected report or SIH deck (none were supplied).
