# Razorpay test-mode integration

This describes the backend Razorpay integration as built. It is **test mode only** unless someone explicitly approves live mode and supplies live credentials.

## What it does

BraillePay can create a Razorpay **order** through the REST Orders API (`POST https://api.razorpay.com/v1/orders`, basic auth with the key id and secret). Razorpay then collects the payment in its Checkout. BraillePay confirms the result on the server.

It is a **merchant checkout** (BraillePay as the seller). It is not a peer-to-peer transfer between BraillePay users. See `P2P_AND_COMPLIANCE.md`.

Razorpay payments are recorded in the `payment_orders` collection. They do **not** change the BraillePay demo ledger (`accounts` balances).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/razorpay/orders` | Create an order. Body is an amount in rupees; the server converts to paise. Returns the public key id, order id and amount. Requires login. |
| GET | `/api/razorpay/orders/{order_id}` | Read an order owned by the caller. |
| POST | `/api/razorpay/verify` | Verify the checkout signature (`razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`). Returns 400 on a bad signature and 409 if the order was already paid by a different payment id. Status becomes `VERIFIED_AWAITING_WEBHOOK`. |
| POST | `/api/razorpay/webhook` | Receives Razorpay events. Verifies the signature over the **raw** body. Handles `payment.captured` (→ `CAPTURED`, or `AMOUNT_MISMATCH` if the amount differs) and `payment.failed` (→ `FAILED`). Duplicate event ids are ignored. |

**Payment success is recorded only from a verified webhook.** A frontend callback alone never marks an order as paid.

## Setup (test mode)

1. In the Razorpay Dashboard, switch to **Test Mode** and create a test key pair. Test keys start with `rzp_test_`.
2. Create a webhook in Test Mode:
   - URL: `https://<your-render-host>/api/razorpay/webhook`
   - Events: `payment.captured`, `payment.failed`
   - Secret: choose a long random value.
3. In Render (or your local `backend/.env`), set:
   - `RAZORPAY_ENABLED=true`
   - `RAZORPAY_MODE=test`
   - `RAZORPAY_KEY_ID=rzp_test_...`
   - `RAZORPAY_KEY_SECRET=...`
   - `RAZORPAY_WEBHOOK_SECRET=...`
   - `RAZORPAY_LIVE_APPROVED=false`
   
   Put secrets only in the host's environment settings. Never in source, `.env.example`, chat, or the docs.
4. Restart the service. If `RAZORPAY_ENABLED` is `false`, all Razorpay routes refuse to create orders.

## Safety rules enforced in code

- **Fail-closed mode guard.** `check_mode` refuses to start or act if:
  - `RAZORPAY_MODE=test` but the key id is not `rzp_test_`;
  - `RAZORPAY_MODE=live` but `RAZORPAY_LIVE_APPROVED` is not `true`, or the key id is not `rzp_live_`.
- **Live mode is not activated by this build.** Enabling it needs explicit approval, approved credentials, and `RAZORPAY_LIVE_APPROVED=true`.
- **No silent fallback.** If Razorpay is configured but unavailable, the order route returns an error. It does not create a simulated payment.
- **Amounts.** Amount validation matches the rest of the app (positive, at most two decimal places, under the configured ceiling). The server does the paise conversion, not the frontend.
- **Signature checks.** Payment signature: HMAC-SHA256 over `order_id|payment_id` with the key secret. Webhook signature: HMAC-SHA256 over the raw request body with the webhook secret. Both use constant-time comparison.

## Limits

- **No frontend Checkout yet.** The browser does not open Razorpay Checkout in this build. The backend is ready for it. Wiring the Checkout widget is a separate step.
- **Razorpay test payments do not move BraillePay balances.** This is intentional, so the demo ledger stays consistent.
- **Not tested against the Razorpay API.** The order client and webhook path were tested with a fake Razorpay client (16 tests in `test_security_and_razorpay.py`). No credentials were available, so no real call was made.
- **Refunds and settlements** are not implemented.
- **Razorpay account terms, KYC and any merchant onboarding** are the account owner's responsibility.

## Going live (not done)

Live mode requires all of the following, and none of them is in this build:
1. Explicit approval from the project owner.
2. A verified live Razorpay account and approved live keys.
3. `RAZORPAY_MODE=live`, `RAZORPAY_LIVE_APPROVED=true`, and an `rzp_live_` key id.
4. A legal and compliance review of what BraillePay is allowed to do with real money.
