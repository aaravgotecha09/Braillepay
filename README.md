[README.md](https://github.com/user-attachments/files/32384722/README.md)
# BraillePay (Simulation) — Backend Phase 1

> **BraillePay is a simulated payment environment. It does not process real
> money or connect to real banking infrastructure, UPI, NPCI, or any bank
> or payment provider.**

This is **Phase 1** of the full-stack rebuild: the backend skeleton,
MongoDB-backed auth (JWT + bcrypt + login lockout), and the 6 seeded demo
users / 2 demo banks / accounts / QR identities. Payments, transaction
history, QR scanning, payment requests, refunds, notifications, demo
reset, WebAuthn, and the frontend wiring are **not in this phase yet** —
see "What's next" below.

## What actually works right now

- `GET /health` — liveness check
- `POST /api/auth/login` — username + PIN → JWT (bcrypt-verified, with
  lockout after repeated failures)
- `GET /api/auth/me` — current user's public profile (never returns
  `pin_hash`)
- `POST /api/auth/logout` — revokes the current JWT
- `GET /api/auth/demo-users` — quick-login list (only when `DEMO_MODE=true`)
- `backend/seed.py` — idempotently creates 2 banks, 6 users, 6 accounts,
  6 QR identities, and 5 sample historical transaction records
- Automated tests for the above (`backend/tests/test_auth.py`)
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
    │   ├── models.py        # Pydantic schemas
    │   ├── deps.py           # get_current_user dependency
    │   └── routes/
    │       └── auth.py       # /api/auth/*
    ├── tests/
    │   └── test_auth.py
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

## What's next (Phases 2–5)

- **Phase 2:** payment engine (`POST /api/payments/send` with atomic
  balance transfer + idempotency), balance API, transaction history +
  filters, QR generate/scan endpoints
- **Phase 3:** payment requests, refunds, notifications, demo
  reset/admin dashboard
- **Phase 4:** wire the existing `braillepay.html` frontend to this API
  (login screen, `api.js` client, replace in-memory Send/Balance state,
  connect the QR privacy verification flow to real recipient lookups)
- **Phase 5:** WebAuthn, the full automated test suite from the original
  spec, deployment polish

I haven't run this end-to-end in a live environment on my side (this
workspace has no network/DB access), so please run the steps above
locally and let me know if anything doesn't come up cleanly before we
move to Phase 2.
