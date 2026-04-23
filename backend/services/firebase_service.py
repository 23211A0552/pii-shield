import firebase_admin
from firebase_admin import credentials, firestore, storage, auth
import os
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

_app = None


def get_firebase_app():
    global _app
    if _app is not None:
        return _app

    try:
        cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
        cred_json = os.getenv("FIREBASE_CREDENTIALS_JSON")

        cred_dict = None
        if cred_json:
            cred_dict = json.loads(cred_json)
        elif cred_path and os.path.exists(cred_path):
            with open(cred_path, 'r') as f:
                cred_dict = json.load(f)

        if not cred_dict:
            raise ValueError("No Firebase credentials provided. Set FIREBASE_CREDENTIALS_JSON or FIREBASE_CREDENTIALS_PATH.")

        # Standardize private key formatting
        if "private_key" in cred_dict and isinstance(cred_dict["private_key"], str):
            raw_key = cred_dict["private_key"]
            # 1. Expand literal \n if they exist
            key = raw_key.replace("\\n", "\n")
            
            # 2. Standardize PEM format
            if "-----BEGIN PRIVATE KEY-----" in key:
                # Remove header/footer and all whitespace to get clean base64 body
                body = key.replace("-----BEGIN PRIVATE KEY-----", "")
                body = body.replace("-----END PRIVATE KEY-----", "")
                body = "".join(body.split()) 
                
                # Reconstruct with proper PEM structure (64 chars per line)
                lines = [body[i:i+64] for i in range(0, len(body), 64)]
                final_key = "-----BEGIN PRIVATE KEY-----\n"
                final_key += "\n".join(lines) + "\n"
                final_key += "-----END PRIVATE KEY-----\n"
                
                cred_dict["private_key"] = final_key
                print(f"[DEBUG] Firebase key reconstructed (64-char wrapped). Len: {len(final_key)}")
            else:
                print(f"[DEBUG] Firebase key header not found. Key len: {len(key)}")
                cred_dict["private_key"] = key

        cred = credentials.Certificate(cred_dict)
        _app = firebase_admin.initialize_app(cred, {
            "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET")
        })
        print("[DEBUG] Firebase initialized successfully")
        return _app
    except Exception as e:
        logger.error(f"Firebase initialization failed: {e}")
        # Print for manual test visibility
        print(f"CRITICAL: Firebase init failed: {e}")
        raise


def get_db():
    get_firebase_app()
    return firestore.client()


def get_bucket():
    get_firebase_app()
    return storage.bucket()


def verify_token(id_token: str) -> dict:
    """Verify Firebase ID token and return decoded claims."""
    try:
        get_firebase_app()
        decoded = auth.verify_id_token(id_token)
        return decoded
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        raise ValueError(f"Invalid or expired token: {str(e)}")


# ── Firestore Helpers ──────────────────────────────────────────────────────────

def save_document_record(document_data: dict) -> str:
    db = get_db()
    ref = db.collection("documents").document()
    document_data["documentId"] = ref.id
    document_data["uploadedAt"] = datetime.utcnow().isoformat()
    ref.set(document_data)
    return ref.id


def update_document_record(doc_id: str, data: dict):
    db = get_db()
    db.collection("documents").document(doc_id).update(data)


def save_scan_results(doc_id: str, detections: list, risk_score: dict, user_id: str = None):
    db = get_db()
    # 1. Delete old results for this document to avoid duplicates on re-scan
    batch = db.batch()
    old_results = db.collection("scan_results").where("documentId", "==", doc_id).stream()
    for doc in old_results:
        batch.delete(doc.reference)
    batch.commit()
    
    # 2. Save each detection as a separate document (aligned with frontend)
    for det in detections:
        ref = db.collection("scan_results").document()
        ref.set({
            "id": ref.id,
            "documentId": doc_id,
            "userId": user_id,
            "piiType": det["pii_type"],
            "detectedValue": det["detected_value"],
            "confidence": int(det["confidence"] * 100),
            "riskLevel": det["risk_level"],
            "detectionMethod": det["detection_method"],
            "start": det["start"],
            "end": det["end"],
            "scannedAt": datetime.utcnow().isoformat(),
        })


def get_user_documents(user_id: str) -> list:
    db = get_db()
    try:
        docs = db.collection("documents").where("userId", "==", user_id).order_by("uploadedAt", direction=firestore.Query.DESCENDING).stream()
        return [doc.to_dict() for doc in docs]
    except Exception as e:
        logger.warning(f"Composite index query failed, using fallback: {e}")
        docs = db.collection("documents").where("userId", "==", user_id).stream()
        return [doc.to_dict() for doc in docs]


def get_document_by_id(doc_id: str) -> dict:
    db = get_db()
    doc = db.collection("documents").document(doc_id).get()
    return doc.to_dict() if doc.exists else None


def get_scan_results_by_doc(doc_id: str) -> list:
    db = get_db()
    results = db.collection("scan_results").where("documentId", "==", doc_id).stream()
    return [r.to_dict() for r in results]


def log_activity(user_id: str, action: str, metadata: dict = None):
    db = get_db()
    ref = db.collection("activity_logs").document()
    ref.set({
        "logId": ref.id,
        "userId": user_id,
        "action": action,
        "metadata": metadata or {},
        "timestamp": datetime.utcnow().isoformat(),
    })


def get_all_documents(limit: int = 100) -> list:
    db = get_db()
    docs = db.collection("documents").order_by("uploadedAt", direction=firestore.Query.DESCENDING).limit(limit).stream()
    return [doc.to_dict() for doc in docs]


def get_all_users(limit: int = 100) -> list:
    db = get_db()
    users = db.collection("users").limit(limit).stream()
    return [u.to_dict() for u in users]


def get_activity_logs(limit: int = 200) -> list:
    db = get_db()
    logs = db.collection("activity_logs").order_by("timestamp", direction=firestore.Query.DESCENDING).limit(limit).stream()
    return [log.to_dict() for log in logs]


def save_user_record(user_id: str, name: str, email: str):
    db = get_db()
    db.collection("users").document(user_id).set({
        "userId": user_id,
        "name": name,
        "email": email,
        "createdAt": datetime.utcnow().isoformat(),
    }, merge=True)


# ── Storage Helpers ──────────────────────────────────────────────────────────

def upload_file_to_storage(file_bytes: bytes, destination_path: str, content_type: str) -> str:
    """Upload bytes to Firebase Storage and return public URL. Falls back to local disk."""
    try:
        bucket = get_bucket()
        blob = bucket.blob(destination_path)
        blob.upload_from_string(file_bytes, content_type=content_type)
        blob.make_public()
        return blob.public_url
    except Exception as e:
        logger.warning(f"Firebase upload failed, saving locally: {e}")
        # Local fallback
        local_dir = os.path.join(os.getcwd(), "data", "storage")
        os.makedirs(os.path.dirname(os.path.join(local_dir, destination_path)), exist_ok=True)
        full_path = os.path.join(local_dir, destination_path)
        with open(full_path, "wb") as f:
            f.write(file_bytes)
        return f"local-file://{destination_path}"


def download_file_from_storage(storage_path: str) -> bytes:
    """Download file bytes from Firebase Storage or local fallback."""
    if storage_path.startswith("local-file://"):
        relative_path = storage_path.replace("local-file://", "")
        local_path = os.path.join(os.getcwd(), "data", "storage", relative_path)
        if os.path.exists(local_path):
            with open(local_path, "rb") as f:
                return f.read()
        raise FileNotFoundError(f"Local storage file not found: {local_path}")

    try:
        bucket = get_bucket()
        blob = bucket.blob(storage_path)
        return blob.download_as_bytes()
    except Exception as e:
        logger.error(f"Firebase download failed: {e}")
        # Try local fallback as last resort (if path was just a relative string)
        local_path = os.path.join(os.getcwd(), "data", "storage", storage_path)
        if os.path.exists(local_path):
            return open(local_path, "rb").read()
        raise
