from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Temporary auth verification for development.
    Always returns a fake user if token exists.
    """
    token = credentials.credentials

    if not token:
        raise HTTPException(status_code=401, detail="Invalid token")

    return {
        "uid": "dev-user",
        "email": "dev@example.com"
    }