from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from utils.auth_middleware import get_current_user
from services.firebase_service import save_user_record, get_activity_logs
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


class UserProfile(BaseModel):
    name: str
    email: str


@router.post("/profile")
async def create_or_update_profile(
    profile: UserProfile,
    user: dict = Depends(get_current_user),
):
    """Create or update user profile in Firestore."""
    save_user_record(user["uid"], profile.name, profile.email)
    return JSONResponse({"success": True, "userId": user["uid"]})


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    """Return current user info from token."""
    return JSONResponse({
        "uid": user["uid"],
        "email": user.get("email"),
        "name": user.get("name"),
    })


@router.get("/activity")
async def get_user_activity(user: dict = Depends(get_current_user)):
    """Get activity logs for current user."""
    from services.firebase_service import get_db
    db = get_db()
    logs = db.collection("activity_logs")\
        .where("userId", "==", user["uid"])\
        .order_by("timestamp")\
        .limit(50)\
        .stream()
    return JSONResponse({"logs": [l.to_dict() for l in logs]})
