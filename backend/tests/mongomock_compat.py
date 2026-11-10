"""
TEST-ONLY compatibility layer for running the payment engine without a MongoDB server.

mongomock (the in-memory stand-in) cannot sort or $inc bson Decimal128 values, which the
payment engine stores balances as. Real MongoDB supports both. This module makes the stand-in
treat Decimal128 as a number. It is imported only by test modules and never by the application.

Real-MongoDB runs (see docs/TESTING.md) do not use this file at all.
"""
from decimal import Decimal

import mongomock.collection as _mc
import mongomock.filtering as _f
from bson.decimal128 import Decimal128

_orig_compare_type = _f._get_compare_type
_orig_bson_compare = _f.bson_compare


def _compare_type(val):
    if isinstance(val, Decimal128):
        return 10  # same sort class as other numbers
    return _orig_compare_type(val)


def _bson_compare(op, a, b, can_compare_types=True):
    if isinstance(a, Decimal128):
        a = a.to_decimal()
    if isinstance(b, Decimal128):
        b = b.to_decimal()
    return _orig_bson_compare(op, a, b, can_compare_types)


_f._get_compare_type = _compare_type
_f.bson_compare = _bson_compare

_orig_inc = _mc._inc_updater


def _inc_updater(doc, field_name, value):
    if isinstance(doc, dict):
        cur = doc.get(field_name, 0)
        if isinstance(cur, Decimal128) or isinstance(value, Decimal128):
            a = cur.to_decimal() if isinstance(cur, Decimal128) else Decimal(str(cur))
            b = value.to_decimal() if isinstance(value, Decimal128) else Decimal(str(value))
            doc[field_name] = Decimal128(a + b)
            return
    return _orig_inc(doc, field_name, value)


for _val in list(vars(_mc).values()):
    if isinstance(_val, dict) and _val.get("$inc") is _orig_inc:
        _val["$inc"] = _inc_updater
