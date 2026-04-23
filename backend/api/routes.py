from fastapi import APIRouter
from api.upload import router as upload_router
from api.documents import router as documents_router
from api.users import router as users_router

router = APIRouter()

# Main application routes (no prefix here since main.py adds /api)
router.include_router(upload_router)

# Resource-specific routes
router.include_router(documents_router, prefix="/documents", tags=["Documents"])
router.include_router(users_router, prefix="/users", tags=["Users"])
