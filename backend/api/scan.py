from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from utils.auth_middleware import get_current_user
from services.firebase_service import get_document_by_id, update_document_record, log_activity
from services.pii_detector import mask_pii, remove_pii
import io
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


class MaskRequest(BaseModel):
    document_id: str
    detection_indices: Optional[List[int]] = None  # None = mask all
    action: str = "MASK"  # MASK or REMOVE
    mask_char: str = "X"


class ScanTextRequest(BaseModel):
    text: str


@router.post("/mask")
async def mask_document(
    request: MaskRequest,
    user: dict = Depends(get_current_user),
):
    """Mask or remove PII from a document and return sanitized text."""
    doc = get_document_by_id(request.document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc["userId"] != user["uid"]:
        raise HTTPException(status_code=403, detail="Access denied")

    extracted_text = doc.get("extractedText", "")
    if not extracted_text:
        raise HTTPException(status_code=422, detail="No extracted text available for this document")

    # Re-detect PII to get current detections with positions
    from services.pii_detector import detect_all_pii
    result = detect_all_pii(extracted_text)
    detections = result["detections"]

    # Filter by indices if specified
    if request.detection_indices is not None:
        detections = [d for i, d in enumerate(detections) if i in request.detection_indices]

    if request.action == "MASK":
        sanitized = mask_pii(extracted_text, detections, request.mask_char)
    elif request.action == "REMOVE":
        sanitized = remove_pii(extracted_text, detections)
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use MASK or REMOVE.")

    # Log activity
    log_activity(user["uid"], "DOCUMENT_SANITIZED", {
        "documentId": request.document_id,
        "action": request.action,
        "piiMasked": len(detections),
    })

    return JSONResponse({
        "success": True,
        "documentId": request.document_id,
        "sanitizedText": sanitized,
        "action": request.action,
        "piiProcessed": len(detections),
    })


@router.post("/download-sanitized")
async def download_sanitized(
    request: MaskRequest,
    user: dict = Depends(get_current_user),
):
    """Download sanitized document as a text file."""
    doc = get_document_by_id(request.document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc["userId"] != user["uid"]:
        raise HTTPException(status_code=403, detail="Access denied")

    extracted_text = doc.get("extractedText", "")
    from services.pii_detector import detect_all_pii
    result = detect_all_pii(extracted_text)
    detections = result["detections"]

    if request.action == "MASK":
        sanitized = mask_pii(extracted_text, detections, request.mask_char)
    else:
        sanitized = remove_pii(extracted_text, detections)

    original_name = doc.get("fileName", "document")
    safe_name = original_name.rsplit(".", 1)[0] + "_sanitized.txt"

    return StreamingResponse(
        io.BytesIO(sanitized.encode("utf-8")),
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )


@router.post("/rescan")
async def rescan_text(request: ScanTextRequest, user: dict = Depends(get_current_user)):
    """Re-scan arbitrary text for PII."""
    from services.pii_detector import detect_all_pii
    result = detect_all_pii(request.text)
    return JSONResponse(result)
