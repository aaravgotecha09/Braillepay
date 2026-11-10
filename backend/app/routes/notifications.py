from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import get_current_user
from app.models import NotificationListResponse, NotificationPublic, UserPublic
from app.services import notification_service

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("", response_model=NotificationListResponse)
async def get_notifications(
    current_user: UserPublic = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
):
    docs = await notification_service.list_notifications(
        current_user.user_id, limit=limit, skip=skip
    )
    unread = await notification_service.count_unread(current_user.user_id)
    return NotificationListResponse(
        items=[NotificationPublic(**d) for d in docs], unread_count=unread
    )


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_notification_read(
    notification_id: str, current_user: UserPublic = Depends(get_current_user)
):
    found = await notification_service.mark_read(current_user.user_id, notification_id)
    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
