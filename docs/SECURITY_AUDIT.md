# Security and audit report

Scope: this repository's frontend (`index.html`, `js/`, `vendor/`, `service-worker.js`, `vercel.json`) and backend (`backend/app/`). Review was done by reading the code and running the tests listed in `TESTING.md`. It was not a penetration test, and no third-party audit was performed.

"Verification" means how the fix was checked: **unit/browser test** or **stand-in test** (in-memory MongoDB) or **code review only**. None of the fixes has been checked against a real MongoDB, a deployed host, or a real device.

## Findings and fixes

| # | Severity | Area | File | Finding | Fix | Verification |
|---|---|---|---|---|---|---|
| 1 | High | Auth | `backend/app/routes/auth.py` | Login lockout was not enforced on the login route. Repeated wrong PINs were not rate-limited. | Login now calls `raise_if_locked`, `register_failed_attempt` and `reset_failed_attempts`. | Stand-in test |
| 2 | High | Privacy | `backend/app/routes/demo.py` | `GET /api/demo/stats` was public and returned recent transactions across all users. | Route now requires a bearer token. Recent transactions are filtered to the caller (sender or receiver). | Stand-in test; `test_phase3.py` updated to the new contract (anonymous → 401) |
| 3 | Medium | Reliability | `security.py`, `services/webauthn_service.py`, `services/payment_request_service.py` | Naive and aware datetimes were compared. This raises `TypeError` in lockout, WebAuthn challenge expiry and payment-request expiry. | Motor client uses `tz_aware=True`; `backend/app/timeutil.py` (`as_utc`) normalises values read back from the database. | Stand-in test |
| 4 | Medium | Payments (frontend) | `js/app.js` | One idempotency key was reused for different payments. | Key is regenerated when the recipient, amount or note changes (fingerprint). | Code review; browser test does not cover this path yet |
| 5 | Medium | Payments (frontend) | `js/app.js` | A timeout or network failure showed "No payment was made", which may be false. | Shows "Payment status unknown" and tells the user to check transaction history before retrying. Writes are never auto-retried. | Code review |
| 6 | Medium | Scanning | `js/upi-parser.js` | A QR code could be read in full (name, amount, note), so a crafted or conflicting code could be spoken as the wrong payee. | Default readout is the payee ID only. Name, amount and note are separate controls. Missing, conflicting, malformed or invalid-VPA codes are rejected without readout. | Unit tests (38) |
| 7 | Medium | Supply chain | `index.html` | jsQR was loaded from a CDN with no integrity check. | Vendored locally at `vendor/jsQR.js` (npm `jsqr@1.4.0`, Apache-2.0 licence kept). No CDN script. | Code review |
| 8 | Medium | Frontend security | `index.html`, `vercel.json` | Inline script and no CSP. | Inline script moved to `js/app.js`. `vercel.json` sets CSP with `script-src 'self'`, `frame-ancestors 'none'`, HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP. | Code review. Headers are not yet confirmed on the live domain |
| 9 | Low | Test quality | `backend/tests/test_payments.py` | Insufficient-balance test used an amount above the demo ceiling, so the ceiling fired first and the test did not test what it claimed. | Amount changed to 999999 (below the ceiling). | Stand-in test (still affected by finding 10) |
| 10 | Low | Test environment | `backend/tests` | Payment-engine tests cannot be verified under the stand-in (Decimal128 sort). | Not fixed in code. Needs a real MongoDB. | **Not verified** |
| 11 | Low | Offline | `service-worker.js` | Service worker could cache API responses. | Caches only the static shell. Never intercepts `/api/`, `/health` or cross-origin requests. Navigation is network-first with an offline page. | Code review |
| 12 | Low | Frontend | `js/app.js` | Transaction history showed a random status (`Math.random`) for each scan. | Each scan adds one history entry with status `read`. | Code review |
| 13 | Medium | Payments (new) | `backend/app/services/razorpay_service.py`, `routes/razorpay.py` | New Razorpay test-mode merchant checkout. Risks: live keys used by mistake; webhook spoofing; duplicate webhooks; trusting the frontend. | Mode guard is fail-closed: live needs `RAZORPAY_MODE=live`, `RAZORPAY_LIVE_APPROVED=true` and an `rzp_live_` key. Key prefix is checked against the mode. Payment signature is HMAC-SHA256 over order and payment id. Webhook signature is checked over the raw body. Webhook events are de-duplicated by event id. Payment is confirmed only by a verified webhook. The BraillePay ledger is not changed. | Stand-in test (16 tests). **Not verified against the Razorpay API.** |
| 14 | Info | Secrets | repository | Scanned for Razorpay keys, Atlas connection strings, private keys and AWS-style keys. None found. `.env.example` files contain placeholders only. | `.gitignore` excludes `.env` files and key files. | Pattern scan, this build |

## Open risks (not fixed)

- **Insecure default JWT secret.** `backend/app/config.py` falls back to `insecure-dev-secret-change-me` if `JWT_SECRET` is not set. A deployment that forgets to set it would accept forgeable tokens. `render.yaml` generates the value, but the code does not refuse to start with the default. Recommended: add a startup check that refuses the default when `DEMO_MODE` is off or the host is not local.
- **Demo mode is on by default** (`DEMO_MODE=true`). Demo users use a shared 4-digit PIN (`1234`). This is intended for the demo, but it is not a production authentication model.
- **`POST /api/demo/reset` needs no login while demo mode is on.** Anyone who can reach a demo deployment can wipe and reseed the demo data. It returns 404 when `DEMO_MODE=false`. Turn demo mode off for any deployment that is not a disposable demo.
- **Dependencies** were pinned from the original repository and were not checked for known CVEs in this pass. Run `pip-audit` and `npm audit` before release.
- **WebAuthn** needs `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGINS` to match the deployed domain exactly. A mismatch fails silently for users.
- **Frontend CSP connect-src** lists only the Render host. Changing the API host requires editing `vercel.json` too.
- **Rate limiting** exists only for login. Other endpoints (payments, QR, Razorpay order creation) have no rate limit. Add one at the edge (Render/Cloudflare) before exposing the API publicly.
- **Razorpay webhook endpoint** must be reachable from Razorpay and protected by its secret. The secret is not in source.

## Not covered by this review

Penetration testing; WebAuthn ceremony testing on real authenticators; a privacy review of QR contents against the applicable data-protection rules; accessibility testing with blind users.
