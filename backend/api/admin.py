from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from utils.auth_middleware import require_admin
from services.firebase_service import get_all_documents, get_all_users, get_activity_logs
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/documents")
async def admin_get_all_documents(admin: dict = Depends(require_admin)):
    """Admin: get all documents across all users."""
    docs = get_all_documents()
    return JSONResponse({"documents": docs, "total": len(docs)})


@router.get("/users")
async def admin_get_all_users(admin: dict = Depends(require_admin)):
    """Admin: get all users."""
    users = get_all_users()
    return JSONResponse({"users": users, "total": len(users)})


@router.get("/logs")
async def admin_get_logs(admin: dict = Depends(require_admin)):
    """Admin: get all activity logs."""
    logs = get_activity_logs()
    return JSONResponse({"logs": logs, "total": len(logs)})


@router.get("/stats")
async def admin_get_stats(admin: dict = Depends(require_admin)):
    """Admin: get system-wide statistics."""
    docs = get_all_documents()
    users = get_all_users()
    logs = get_activity_logs()

    risk_breakdown = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "UNKNOWN": 0, "SAFE": 0}
    total_pii = 0

    for doc in docs:
        level = doc.get("riskLevel", "UNKNOWN")
        risk_breakdown[level] = risk_breakdown.get(level, 0) + 1
        total_pii += doc.get("totalPiiFound", 0)

    return JSONResponse({
        "totalDocuments": len(docs),
        "totalUsers": len(users),
        "totalLogs": len(logs),
        "totalPiiDetected": total_pii,
        "riskBreakdown": risk_breakdown,
    })
