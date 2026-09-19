"""
Money handling helpers.

Balances and transaction amounts are stored in MongoDB as Decimal128 (not
float / not int-of-paise) so we never accumulate floating-point rounding
error across many simulated transactions. Python-side arithmetic uses
`decimal.Decimal`; only at the API boundary do we convert to a plain
float for JSON.
"""
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from bson.decimal128 import Decimal128
from fastapi import HTTPException, status

from app.config import get_settings

settings = get_settings()

TWO_PLACES = Decimal("0.01")


def to_decimal128(value: Decimal) -> Decimal128:
    return Decimal128(value)


def from_decimal128(value) -> Decimal:
    """Accepts Decimal128, Decimal, int, float, or str and returns Decimal."""
    if isinstance(value, Decimal128):
        return value.to_decimal()
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def to_float(value) -> float:
    return float(from_decimal128(value).quantize(TWO_PLACES, rounding=ROUND_HALF_UP))


def validate_amount(raw_amount) -> Decimal:
    """Validate an incoming payment amount and return it as a Decimal.

    Rules (Part 26 of the spec):
    - must be a well-formed number
    - must be > 0
    - at most 2 decimal places
    - must not exceed the configured demo transfer limit
    """
    try:
        amount = Decimal(str(raw_amount))
    except (InvalidOperation, ValueError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Amount is not a valid number",
        )

    if amount.is_nan() or amount.is_infinite():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Amount is not a valid number",
        )

    if amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Amount must be greater than ₹0",
        )

    # More than 2 decimal places?
    exponent = amount.as_tuple().exponent
    if isinstance(exponent, int) and exponent < -2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Amount must have at most two decimal places",
        )

    if amount > Decimal(str(settings.max_payment_amount)):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Amount exceeds the demo transfer limit of "
                f"₹{settings.max_payment_amount:,.2f}"
            ),
        )

    return amount.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
