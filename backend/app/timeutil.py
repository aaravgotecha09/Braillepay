"""
Datetime helpers.

PyMongo/Motor return datetimes as NAIVE values (UTC) unless the client is created with
tz_aware=True. Comparing a naive value with datetime.now(timezone.utc) raises TypeError, which
turned into HTTP 500s in the lockout, WebAuthn challenge and payment-request expiry checks.
The client is now created with tz_aware=True (app/database.py), and as_utc() is used at every
comparison so the code is correct even if a naive value slips through.
"""
from datetime import datetime, timezone


def as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
