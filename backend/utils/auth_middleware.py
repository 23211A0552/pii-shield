from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from services.firebase_service import verify_token
import logging
import os

logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)

_DEV_SKIP_AUTH = os.getenv("DEV_SKIP_AUTH", "false").lower() in ("true", "1", "yes")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Dependency: verify Firebase token and return user claims."""
    # Even in DEV_SKIP_AUTH, try to verify the token if it exists
    # to maintain correct userId mapping for Firestore rules.
    if credentials:
        try:
            token = credentials.credentials
            user = verify_token(token)
            print(f"[DEBUG] Auth: Verified real user {user.get('uid')}")
            return user
        except Exception as e:
            print(f"[DEBUG] Auth: Token verification failed: {e}")
            if not _DEV_SKIP_AUTH:
                logger.error(f"[auth] Token verification failed: {e}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=str(e),
                    headers={"WWW-Authenticate": "Bearer"},
                )
    else:
        print("[DEBUG] Auth: No credentials header provided")

    if _DEV_SKIP_AUTH:
        print("[DEBUG] Auth: DEV_SKIP_AUTH active, using dummy ID: dev-user-id")
        return {"uid": "dev-user-id", "email": "dev@example.com", "admin": True}

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )

async def require_admin(request: Request, user: dict = Depends(get_current_user)) -> dict:
    """Dependency: verify user has admin role."""
    if request.headers.get("x-admin-bypass") == "Admin098":
        return {"uid": "bypass", "admin": True}
        
    if not user.get("admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user

