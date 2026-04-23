from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from utils.auth_middleware import get_current_user
from services.firebase_service import get_user_documents, get_document_by_id, get_scan_results_by_doc
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/")
async def list_documents(user: dict = Depends(get_current_user)):
    """Get all documents for the current user."""
    docs = get_user_documents(user["uid"])
    return JSONResponse({"documents": docs, "total": len(docs)})


@router.get("/{doc_id}")
async def get_document(doc_id: str, user: dict = Depends(get_current_user)):
    """Get a specific document by ID."""
    doc = get_document_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc["userId"] != user["uid"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return JSONResponse(doc)


@router.get("/{doc_id}/scan-results")
async def get_scan_results(doc_id: str, user: dict = Depends(get_current_user)):
    """Get scan results for a document."""
    doc = get_document_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc["userId"] != user["uid"]:
        raise HTTPException(status_code=403, detail="Access denied")

    results = get_scan_results_by_doc(doc_id)
    return JSONResponse(results or {"documentId": doc_id, "detections": []})
