from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Response
from fastapi.responses import JSONResponse, StreamingResponse
from utils.auth_middleware import get_current_user
from services.ocr_service import extract_text, extract_text_with_coords
from services.firebase_service import save_document_record, upload_file_to_storage, update_document_record, save_scan_results
from services.pii_detector import detect_all_pii
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    document_id: str = Form(None),
    user: dict = Depends(get_current_user)
):
    print(f"[DEBUG] Uploading document for UID: {user['uid']}")
    try:
        content = await file.read()
        
        # 1. Extract text (+ word_map for images)
        extracted_text, word_map = extract_text_with_coords(
            content, file.content_type, file.filename
        )
        print(f"[DEBUG] Extracted Text ({len(extracted_text)} chars): {extracted_text[:500]}...")
        
        # 2. Upload to Storage (Optional/Best Effort for 'completely free' tier)
        storage_path = f"documents/{user['uid']}/{uuid.uuid4()}_{file.filename}"
        file_url = ""
        try:
            file_url = upload_file_to_storage(content, storage_path, file.content_type)
        except Exception as se:
            print(f"[upload] Storage skip/fail: {se}")
            # Fallback to a dummy URL if storage is not configured/available
            file_url = f"local-v-document://{storage_path}"
        
        # 3. Save initial record to Firestore
        doc_data = {
            "userId": user["uid"],
            "fileName": file.filename,
            "fileUrl": file_url,
            "storagePath": storage_path,
            "contentType": file.content_type,
            "fileSize": len(content),
            "extractedText": extracted_text,
            "scanStatus": "UPLOADED",
            "riskLevel": "PENDING",
            "riskScore": 0,
            "totalPiiFound": 0
        }
        
        new_doc_id = save_document_record(doc_data)
        
        return JSONResponse({
            "documentId": new_doc_id,
            "extractionMethod": "OCR" if "image" in file.content_type else "TEXT",
            "charCount": len(extracted_text)
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.post("/scan/{doc_id}")
async def scan_document(doc_id: str, user: dict = Depends(get_current_user)):
    """
    Perform PII detection on an uploaded document.
    """
    from services.firebase_service import get_document_by_id
    doc = get_document_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc["userId"] != user["uid"]:
        raise HTTPException(status_code=403, detail="Access denied")
        
    text = doc.get("extractedText", "")
    results = detect_all_pii(text)
    print(f"[DEBUG] Scan Results for {doc_id}: {results['total_found']} found. Types: {results['pii_types_found']}")
    
    # Update document with scan results
    risk = results["risk_score"]
    update_data = {
        "scanStatus": "SCANNED",
        "riskLevel": risk["level"],
        "riskScore": risk["score"],
        "totalPiiFound": results["total_found"],
        "piiTypesFound": results["pii_types_found"],
        "documentType": results["document_type"],   # e.g. 'aadhaar', 'pan', 'general'
    }
    update_document_record(doc_id, update_data)
    
    # Save detailed scan results (now saves individual docs with ownership)
    save_scan_results(doc_id, results["detections"], risk, user_id=user["uid"])
    
    return JSONResponse({
        "documentId": doc_id,
        "riskLevel": risk["level"],
        "piiCount": results["total_found"],
        "results": results["detections"]  # This list should match the structure of saved docs
    })

@router.post("/sanitize/{doc_id}")
async def sanitize_document_route(
    doc_id: str,
    payload: dict,
    user: dict = Depends(get_current_user)
):
    """
    Sanitize a document based on actions (mask, remove, etc.)
    """
    from services.firebase_service import get_document_by_id
    from services.pii_detector import mask_pii, remove_pii, detect_all_pii
    
    doc = get_document_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc["userId"] != user["uid"]:
        raise HTTPException(status_code=403, detail="Access denied")
        
    text = doc.get("extractedText", "")
    actions = payload.get("actions", {}) # { resultId: 'mask'|'remove'|'ignore' }
    
    # In a real app, we'd use the saved scan results. 
    # For now, we'll re-detect to find positions and apply actions.
    results = detect_all_pii(text)
    detections = results["detections"]
    
    # We apply a simple 'mask all' if it's the simplest way, 
    # but let's try to honor the 'remove' action if present in any action.
    if any(a == "remove" for a in actions.values()):
        sanitized = remove_pii(text, detections)
    else:
        sanitized = mask_pii(text, detections)
        
    return JSONResponse({
        "success": True,
        "documentId": doc_id,
        "sanitizedText": sanitized
    })

@router.get("/download/{doc_id}")
async def download_sanitized_route(doc_id: str, user: dict = Depends(get_current_user)):
    """
    Download the sanitized version of a document, preserving original formatting.
    """
    from services.firebase_service import get_document_by_id, download_file_from_storage
    from services.pii_detector import detect_all_pii, mask_pii
    from services.document_parser import redact_pdf, redact_docx, redact_image
    from services.ocr_service import extract_text_from_image
    import io
    from fastapi.responses import StreamingResponse
    
    doc = get_document_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.get("userId") != user["uid"] and not user.get("admin"):
        raise HTTPException(status_code=403, detail="Access denied")
        
    # 1. Fetch original file bytes
    try:
        # If fileUrl starts with local-file://, use that as the source
        source_path = doc.get("fileUrl", "") if doc.get("fileUrl", "").startswith("local-file://") else doc.get("storagePath", "")
        original_bytes = download_file_from_storage(source_path)
    except Exception as e:
        logger.error(f"Failed to fetch original file: {e}")
        # Fallback to text if original is missing
        text = doc.get("extractedText", "")
        results = detect_all_pii(text)
        sanitized = mask_pii(text, results["detections"])
        return Response(
            content=sanitized.encode("utf-8"),
            media_type="text/plain",
            headers={"Content-Disposition": f'attachment; filename="sanitized_{doc["fileName"]}.txt"'}
        )

    # 2. Get detections
    content_type = doc.get("contentType", "").lower()
    text = doc.get("extractedText", "")
    
    word_map = []
    if content_type.startswith("image/"):
        # Re-run OCR with filename hint to get word-level coordinates for redaction
        from services.ocr_service import _guess_hint
        hint = _guess_hint(doc.get("fileName", ""))
        from services.ocr_service import extract_text_from_image
        word_map = extract_text_from_image(original_bytes, hint=hint, return_coords=True)
        
    results = detect_all_pii(text, word_map=word_map)
    detections = results["detections"]
    
    # 3. Apply format-specific redaction
    content_type = doc.get("contentType", "").lower()
    filename = doc.get("fileName", "document")
    sanitized_bytes = None
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    # Normalise media_type: "image/jpg" is not a valid MIME — use "image/jpeg"
    media_type = "image/jpeg" if content_type in ("image/jpg", "image/jpeg") else content_type

    if content_type == "application/pdf" or ext == "pdf":
        sanitized_bytes = redact_pdf(original_bytes, detections)
        media_type = "application/pdf"
    elif ext == "docx" or "wordprocessingml" in content_type:
        sanitized_bytes = redact_docx(original_bytes, detections)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif content_type.startswith("image/"):
        # Compute scale factor: Tesseract OCR upscales images to 2000px wide,
        # so bbox coordinates are in that space. We need to scale them back to
        # the original image dimensions before drawing redaction boxes.
        try:
            from PIL import Image as _PIL, ImageOps as _ImageOps
            import io as _io
            _orig_img = _PIL.open(_io.BytesIO(original_bytes))
            _orig_img = _ImageOps.exif_transpose(_orig_img) # Real width depends on orientation
            orig_w = _orig_img.width
            # _preprocess() upscales to 2000px if width < 1500, else no scale
            ocr_w = max(orig_w, 2000) if orig_w < 1500 else orig_w
            scale_factor = orig_w / ocr_w
        except Exception:
            scale_factor = 1.0
        sanitized_bytes = redact_image(original_bytes, detections, scale_factor=scale_factor, filename=filename)
        # media_type already set above (normalised jpeg)

    else:
        # Fallback for text files or others
        sanitized_text = mask_pii(text, detections)
        sanitized_bytes = sanitized_text.encode("utf-8")
        media_type = "text/plain"
        if not filename.endswith(".txt"): filename += ".txt"

    return Response(
        content=sanitized_bytes,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="sanitized_{filename}"',
            "Content-Length": str(len(sanitized_bytes))
        }
    )
