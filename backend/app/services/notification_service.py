"""
Notifications are created by other services (payment_service,
payment_request flows, refunds) whenever something happens that the
affected user should be told about. This module is just the shared
create/list/mark-read logic so that isn't duplicated per call site.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.database import get_db


async def create_notification(
    *,
    user_id: str,
    type: str,
    title: str,
    message: str,
    data: Optional[dict] = None,
) -> dict:
    db = get_db()
    doc = {
        "notification_id": f"notif_{uuid.uuid4().hex[:16]}",
        "user_id": user_id,
        "type": type,
        "title": title,
        "message": message,
        "data": data or {},
        "read": False,
        "created_at": datetime.now(timezone.utc),
    }
    await db.notifications.insert_one(doc)
    return doc


async def list_notifications(user_id: str, limit: int = 50, skip: int = 0) -> list[dict]:
    db = get_db()
    cursor = (
        db.notifications.find({"user_id": user_id})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    return await cursor.to_list(length=limit)


async def count_unread(user_id: str) -> int:
    db = get_db()
    return await db.notifications.count_documents({"user_id": user_id, "read": False})


async def mark_read(user_id: str, notification_id: str) -> bool:
    db = get_db()
    result = await db.notifications.update_one(
        {"notification_id": notification_id, "user_id": user_id},
        {"$set": {"read": True}},
    )
    return result.matched_count > 0
