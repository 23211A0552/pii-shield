from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime


class PIIDetection(BaseModel):
    pii_type: str
    detected_value: str
    start: int
    end: int
    confidence: float
    risk_level: str
    detection_method: str


class RiskScore(BaseModel):
    score: int
    level: str
    breakdown: Dict[str, int]


class ScanResult(BaseModel):
    detections: List[PIIDetection]
    total_found: int
    risk_score: RiskScore
    pii_types_found: List[str]


class DocumentRecord(BaseModel):
    documentId: Optional[str] = None
    userId: str
    fileName: str
    fileUrl: str
    storagePath: str
    contentType: str
    fileSize: int
    scanStatus: str = "PENDING"
    riskLevel: str = "UNKNOWN"
    riskScore: Optional[int] = None
    totalPiiFound: Optional[int] = None
    piiTypesFound: Optional[List[str]] = None
    uploadedAt: Optional[str] = None


class UserRecord(BaseModel):
    userId: str
    name: str
    email: str
    createdAt: Optional[str] = None


class ActivityLog(BaseModel):
    logId: Optional[str] = None
    userId: str
    action: str
    metadata: Optional[Dict[str, Any]] = None
    timestamp: Optional[str] = None
