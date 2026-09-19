[README.md](https://github.com/user-attachments/files/32413198/README.md)
# BraillePay (Simulation) — Backend Phases 1–3, Frontend Phase 4

> **BraillePay is a simulated payment environment. It does not process real
> money or connect to real banking infrastructure, UPI, NPCI, or any bank
> or payment provider.**

This covers **Phases 1–4** of the full-stack rebuild: auth, the 6 seeded
demo users / 2 demo banks / accounts / QR identities, the core payment
engine (send money, balance, transaction history with filters, QR
generate/scan), payment requests/refunds/notifications/demo reset, and
now — the existing `braillepay.html` frontend wired to all of it. Full
QR-camera-to-payment integration, a Receive Money screen, and a
Payment Requests UI are **not in yet** — see "What's next" below.

## What actually works right now

**Auth (Phase 1)**
- `GET /health` — liveness check
- `POST /api/auth/login` — username + PIN → JWT (bcrypt-verified, with
  lockout after repeated failures)
- `GET /api/auth/me` — current user's public profile (never returns
  `pin_hash`)
- `POST /api/auth/logout` — revokes the current JWT
- `GET /api/auth/demo-users` — quick-login list (only when `DEMO_MODE=true`)

**Payments, balance, transactions, QR (Phase 2)**
- `POST /api/payments/send` — the payment engine. Validates the amount
  server-side (Decimal-based, >0, ≤2 decimal places, under the configured
  demo ceiling), rejects unknown recipients and self-payments, atomically
  debits the sender only if funds are sufficient (so two concurrent sends
  can never double-spend), credits the receiver, and writes a single
  transaction record. Supports an `Idempotency-Key` header so retries
  never double-charge. Uses a real multi-document Mongo transaction when
  the server supports one (replica set / Atlas), and falls back to a
  guarded atomic update + compensation on a standalone Mongo.
- `GET /api/accounts/balance` — authoritative balance, read from the DB
- `GET /api/transactions` — history scoped to the caller only, with
  `type`, `status`, `date_from`/`date_to`, `search`, `min_amount`,
  `max_amount`, `limit`/`skip`
- `GET /api/transactions/{transaction_id}` — single transaction (404s if
  it isn't yours, same response as a nonexistent ID)
- `POST /api/qr/generate`, `GET /api/qr/my`, `GET /api/qr/{qr_id}`,
  `GET /api/qr/user/{user_id}`, `GET /api/qr/demo-list` — QR identities,
  image rendered on the fly with the `qrcode` library, payload has no
  sensitive data (no PIN, no balance, no bank details, no token)

**Payment requests, refunds, notifications, demo reset (Phase 3)**
- `POST /api/payments/{transaction_id}/refund` — only the original
  *recipient* of a SUCCESS payment can refund it; the refund is a new
  REFUND-type transaction (money actually moves back), and a
  find-and-set-atomically guard means the same payment can never be
  refunded twice, even under concurrent requests.
- `POST /api/payment-requests`, `GET /api/payment-requests?direction=`,
  `POST /api/payment-requests/{id}/pay`, `.../decline`, `.../cancel` —
  ask another demo user for money; paying a request reuses the exact
  same payment engine (with a request-derived idempotency key, so it can
  never be paid twice) rather than duplicating transfer logic.
- `GET /api/notifications`, `POST /api/notifications/{id}/read` —
  notifications are created automatically on payment sent/received,
  refund received, and payment request received/paid.
- `POST /api/demo/reset` — restores all six demo accounts to their
  seeded starting balances, wipes demo transactions/requests/
  notifications, and recreates the sample history. Demo-mode only.
- `GET /api/demo/stats` — totals for an optional admin/demo dashboard
  (users, banks, transaction counts, money moved). Demo-mode only.

**Infrastructure**
- `backend/seed.py` — thin CLI wrapper around `app/services/seed_service.py`
  (the canonical demo-data source, shared with `/api/demo/reset` so the
  numbers can't drift between the two)
- Automated tests: `backend/tests/test_auth.py`, `backend/tests/test_payments.py`,
  `backend/tests/test_phase3.py`
- Dockerfile + docker-compose for backend + MongoDB

## Project structure

```
braillepay/
├── docker-compose.yml
└── backend/
    ├── app/
    │   ├── main.py          # FastAPI app, CORS, health, startup indexes
    │   ├── config.py        # env-var settings
    │   ├── database.py      # Motor client + index creation
    │   ├── security.py      # bcrypt, JWT, login lockout
    │   ├── money.py         # Decimal128 <-> Decimal, amount validation
    │   ├── models.py        # Pydantic schemas
    │   ├── serializers.py   # shared DB-doc -> API-schema conversion
    │   ├── deps.py          # get_current_user dependency
    │   ├── services/
    │   │   ├── payment_service.py         # the ONLY place money moves
    │   │   ├── payment_request_service.py # request-money lifecycle
    │   │   ├── notification_service.py    # create/list/mark-read
    │   │   ├── seed_service.py            # canonical demo data + reset
    │   │   └── qr_service.py              # QR payload + image generation
    │   └── routes/
    │       ├── auth.py             # /api/auth/*
    │       ├── accounts.py         # /api/accounts/balance
    │       ├── payments.py         # /api/payments/send, /{id}/refund
    │       ├── transactions.py     # /api/transactions*
    │       ├── qr.py               # /api/qr/*
    │       ├── payment_requests.py # /api/payment-requests*
    │       ├── notifications.py    # /api/notifications*
    │       └── demo.py             # /api/demo/reset, /api/demo/stats
    ├── tests/
    │   ├── test_auth.py
    │   ├── test_payments.py
    │   └── test_phase3.py
    ├── seed.py
    ├── requirements.txt
    ├── requirements-dev.txt
    ├── pytest.ini
    ├── Dockerfile
    └── .env.example
```

## Running locally

1. **Start MongoDB** (or use the provided compose file for both services):

   ```bash
   docker compose up -d mongo
   ```

2. **Install backend dependencies:**

   ```bash
   cd backend
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env   # edit JWT_SECRET etc. as needed
   ```

3. **Seed demo data:**

   ```bash
   python seed.py
   ```

   This prints the demo login credentials when done (username + PIN
   `1234` for all six).

4. **Run the API:**

   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

   Swagger docs: http://localhost:8000/docs

5. **Try it:**

   ```bash
   curl -X POST http://localhost:8000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"aarav","pin":"1234"}'
   ```

## Running with Docker Compose (backend + MongoDB together)

```bash
docker compose up --build
# in another terminal, once it's up:
docker compose exec backend python seed.py
```

## Running tests

```bash
cd backend
pip install -r requirements-dev.txt
pytest -v
```

(Tests need a live MongoDB with demo data seeded — same as running the
app locally.)

## Demo accounts

| Username | Name           | UPI ID              | PIN  | Bank                     |
|----------|----------------|----------------------|------|--------------------------|
| aarav    | Aarav Gotecha  | aarav@braillepay     | 1234 | Braille National Bank    |
| shivani  | Shivani Mehta  | shivani@braillepay   | 1234 | Braille National Bank    |
| rahul    | Rahul Shah     | rahul@braillepay     | 1234 | Braille National Bank    |
| priya    | Priya Desai    | priya@braillepay     | 1234 | Accessible Digital Bank  |
| rohan    | Rohan Patel    | rohan@braillepay     | 1234 | Accessible Digital Bank  |
| ananya   | Ananya Kapoor  | ananya@braillepay    | 1234 | Accessible Digital Bank  |

## Demo banks

| Name                      | Code | IFSC        |
|---------------------------|------|-------------|
| Braille National Bank     | BNB  | BRLP000001  |
| Accessible Digital Bank   | ADB  | BRLP000002  |

Both are entirely fictional — not real financial institutions.

## Trying the payment flow

```bash
# Log in as Aarav
curl -s -X POST localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"aarav","pin":"1234"}' | tee /tmp/login.json

TOKEN=$(python3 -c "import json;print(json.load(open('/tmp/login.json'))['access_token'])")

# Send ₹500 to Shivani (Idempotency-Key protects against accidental retries)
curl -s -X POST localhost:8000/api/payments/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"receiver_upi":"shivani@braillepay","amount":500,"note":"Lunch"}'

# Check the new balance and history
curl -s localhost:8000/api/accounts/balance -H "Authorization: Bearer $TOKEN"
curl -s localhost:8000/api/transactions -H "Authorization: Bearer $TOKEN"

# Ask Shivani for money back, refund a payment, check notifications
curl -s -X POST localhost:8000/api/payment-requests \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"payer_upi":"shivani@braillepay","amount":100,"note":"Splitting cab"}'

curl -s -X POST localhost:8000/api/payments/<transaction_id>/refund \
  -H "Authorization: Bearer $TOKEN"

curl -s localhost:8000/api/notifications -H "Authorization: Bearer $TOKEN"

# Reset all six demo accounts back to their starting balances
curl -s -X POST localhost:8000/api/demo/reset
curl -s localhost:8000/api/demo/stats
```

Balances drift as you test the payment/refund/request flows — that's
what `POST /api/demo/reset` (Phase 3) is for: it restores all six
accounts to their seeded starting balances and rebuilds the sample
transaction history.

## What's next (Phases 4–5)

- **Phase 4:** wire the existing `braillepay.html` frontend to this API
  (login screen, `api.js` client, replace in-memory Send/Balance state,
  connect the QR privacy verification flow to real recipient lookups)
- **Phase 5:** WebAuthn, the full automated test suite from the original
  spec, deployment polish

I haven't run this end-to-end in a live environment on my side (this
workspace has no network/DB access), so please run the steps above
locally and let me know if anything doesn't come up cleanly before we
move to Phase 4.
