"""
Admin API routes.

In development set DEV_DISABLE_ADMIN_CHECK=true in backend/.env to bypass
the role check so you can access the admin dashboard without setting up a
Firestore 'admin' role.  Never set this in production.
"""
import os
from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import firestore as _fs  # for Query.DESCENDING constant
from utils.auth_middleware import get_current_user, require_admin
from services.firebase_service import get_db

admin_router = APIRouter()

import logging
logger = logging.getLogger(__name__)


@admin_router.get("/stats")
async def admin_stats(user: dict = Depends(require_admin)):
    try:
        db = get_db()
        users_stream = db.collection("users").stream()
        users_count = sum(1 for _ in users_stream)

        docs_stream = db.collection("documents").stream()
        docs_data = [d.to_dict() for d in docs_stream]

        total_pii = sum(d.get("totalPiiFound", d.get("piiCount", 0)) for d in docs_data)
        high_risk = sum(1 for d in docs_data if d.get("riskLevel") == "HIGH")

        # Aggregated breakdowns expected by the Overview tab
        risk_breakdown: dict = {}
        pii_type_breakdown: dict = {}
        doc_type_breakdown: dict = {}
        for d in docs_data:
            level = d.get("riskLevel", "SAFE")
            risk_breakdown[level] = risk_breakdown.get(level, 0) + 1

            doc_type = d.get("documentType", "general")
            doc_type_breakdown[doc_type] = doc_type_breakdown.get(doc_type, 0) + 1

            for pt in (d.get("piiTypesFound") or []):
                pii_type_breakdown[pt] = pii_type_breakdown.get(pt, 0) + 1

        # Count activity logs
        logs_stream = db.collection("activity_logs").stream()
        logs_count = sum(1 for _ in logs_stream)

        return {
            "totalUsers":            users_count,
            "totalDocuments":        len(docs_data),
            "totalPiiDetected":      total_pii,
            "highRiskDocuments":     high_risk,
            "totalLogs":             logs_count,
            "riskBreakdown":         risk_breakdown,
            "piiTypeBreakdown":      pii_type_breakdown,
            "documentTypeBreakdown": doc_type_breakdown,
        }
    except Exception as exc:
        logger.error(f"[admin] Stats query failed: {exc}")
        return {
            "totalUsers": 0, "totalDocuments": 0,
            "totalPiiDetected": 0, "highRiskDocuments": 0,
            "totalLogs": 0, "riskBreakdown": {}, "piiTypeBreakdown": {},
            "documentTypeBreakdown": {},
            "error": str(exc),
        }


@admin_router.get("/documents")
async def admin_documents(page: int = 1, limit: int = 100, user: dict = Depends(require_admin)):
    try:
        db = get_db()
        try:
            docs = (
                db.collection("documents")
                .order_by("uploadedAt", direction=_fs.Query.DESCENDING)
                .limit(limit)
                .stream()
            )
            # Ensure documentId field is always present
            data = [{"documentId": d.id, **d.to_dict()} for d in docs]
            return {"documents": data, "page": page}
        except Exception as e:
            logger.warning(f"[admin] Documents index missing, using fallback: {e}")
            docs = db.collection("documents").limit(limit).stream()
            data = [{"documentId": d.id, **d.to_dict()} for d in docs]
            return {"documents": data, "page": page, "warning": "Order by failed (index missing)"}
    except Exception as exc:
        logger.error(f"[admin] Documents query failed: {exc}")
        return {"documents": [], "page": page, "error": str(exc)}


@admin_router.get("/users")
async def admin_users(user: dict = Depends(require_admin)):
    try:
        db = get_db()
        users = db.collection("users").stream()
        return {"users": [{"userId": u.id, **u.to_dict()} for u in users]}
    except Exception as exc:
        logger.error(f"[admin] Users query failed: {exc}")
        return {"users": [], "error": str(exc)}


@admin_router.get("/logs")
async def admin_logs(limit: int = 50, user: dict = Depends(require_admin)):
    """Return recent activity logs, ordered by timestamp descending."""
    try:
        db = get_db()
        try:
            logs_ref = (
                db.collection("activity_logs")
                .order_by("timestamp", direction=_fs.Query.DESCENDING)
                .limit(limit)
                .stream()
            )
            data = [{"logId": log.id, **log.to_dict()} for log in logs_ref]
        except Exception as e:
            logger.warning(f"[admin] Logs index missing, using fallback: {e}")
            logs_ref = db.collection("activity_logs").limit(limit).stream()
            data = [{"logId": log.id, **log.to_dict()} for log in logs_ref]
        return {"logs": data}
    except Exception as exc:
        logger.error(f"[admin] Logs query failed: {exc}")
        return {"logs": [], "error": str(exc)}
