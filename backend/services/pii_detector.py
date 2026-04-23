"""
pii_detector.py
~~~~~~~~~~~~~~~
Universal PII detection engine supporting:
  - Aadhaar (UID / VID)
  - PAN Card
  - Credit / Debit Cards (Visa, MC, Amex, Discover, RuPay, JCB)
  - Bank Accounts & IFSC / IBAN / SWIFT
  - Passports (Indian + International MRZ)
  - Driving Licence (Indian)
  - Voter ID
  - GST Number
  - Phone numbers (Indian + International)
  - Email addresses
  - Dates of Birth
  - CVV / Card Expiry
  - SSN (US)
  - Names, Addresses, Organisations (via NER)
  - Pincode / ZIP
  - IP Address
"""

import re
import logging
import unicodedata
from typing import Any, Dict, List, Tuple

logger = logging.getLogger(__name__)

# ── spaCy ─────────────────────────────────────────────────────────────────────
try:
    import spacy
    nlp = spacy.load("en_core_web_sm")
    SPACY_AVAILABLE = True
except Exception:
    logger.warning("spaCy model not available – NER disabled.")
    SPACY_AVAILABLE = False


# ══════════════════════════════════════════════════════════════════════════════
# 1.  REGEX PATTERN REGISTRY
# ══════════════════════════════════════════════════════════════════════════════

PATTERNS: Dict[str, Dict[str, Any]] = {

    # ── Indian Government IDs ─────────────────────────────────────────────────
    "AADHAAR": {
        "pattern": r"\b([2-9]\d{3})[\s.\-]?(\d{4})[\s.\-]?(\d{4})\b",
        "risk_level": "HIGH",
        "confidence": 0.98,
        "case_sensitive": True,
    },
    "AADHAAR_VID": {
        "pattern": r"\b(\d{4})[\s.\-]?(\d{4})[\s.\-]?(\d{4})[\s.\-]?(\d{4})\b",
        "risk_level": "HIGH",
        "confidence": 0.93,
        "case_sensitive": True,
    },
    "PAN": {
        "pattern": r"\b([A-Z]{5})(\d{4})([A-Z])\b",
        "risk_level": "HIGH",
        "confidence": 0.98,
        "case_sensitive": False,
    },
    "VOTER_ID": {
        "pattern": r"\b([A-Z]{3})(\d{7})\b",
        "risk_level": "HIGH",
        "confidence": 0.88,
        "case_sensitive": False,
    },
    "DRIVING_LICENCE": {
        "pattern": r"\b([A-Z]{2})(\d{2})\s?(\d{4})\s?(\d{7})\b",
        "risk_level": "HIGH",
        "confidence": 0.85,
        "case_sensitive": False,
    },
    "GST": {
        "pattern": r"\b(\d{2})([A-Z]{5}\d{4}[A-Z])(\d)([Z])([A-Z\d])\b",
        "risk_level": "MEDIUM",
        "confidence": 0.92,
        "case_sensitive": False,
    },

    # ── Passport ─────────────────────────────────────────────────────────────
    "PASSPORT_IN": {
        "pattern": r"\b([A-Z])(\d{7})\b",
        "risk_level": "HIGH",
        "confidence": 0.88,
        "case_sensitive": False,
    },
    "MRZ_LINE": {
        "pattern": r"[A-Z0-9<]{44}",
        "risk_level": "HIGH",
        "confidence": 0.95,
        "case_sensitive": True,
    },

    # ── Financial ─────────────────────────────────────────────────────────────
    "CREDIT_CARD": {
        "pattern": (
            r"\b(?:"
            r"4\d{3}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}"           # Visa 16
            r"|4\d{3}[\s\-]?\d{6}[\s\-]?\d{5}"                        # Visa 13
            r"|5[1-5]\d{2}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}"      # MC classic
            r"|2[2-7]\d{2}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}"      # MC new BINs
            r"|3[47]\d{2}[\s\-]?\d{6}[\s\-]?\d{5}"                    # Amex
            r"|3(?:0[0-5]|[68]\d)\d[\s\-]?\d{6}[\s\-]?\d{4}"         # Diners
            r"|6(?:011|5\d{2})[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}"  # Discover
            r"|(?:2131|1800|35\d{3})[\s\-]?\d{4}[\s\-]?\d{4}"        # JCB
            r"|6[0-9]{3}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}"        # RuPay
            r")\b"
        ),
        "risk_level": "HIGH",
        "confidence": 0.92,
        "case_sensitive": True,
    },
    "CVV": {
        "pattern": r"(?:CVV2?|CVC2?|CSC|Security\s+Code)[:\s]+(\d{3,4})\b",
        "risk_level": "HIGH",
        "confidence": 0.94,
        "case_sensitive": False,
    },
    "CARD_EXPIRY": {
        "pattern": r"(?:(?:Valid(?:\s+Thru|\s+Through)?|Expiry|Expires?)[:\s]+)?(0[1-9]|1[0-2])[\/\s](2[0-9]|20[2-9]\d)\b",
        "risk_level": "MEDIUM",
        "confidence": 0.80,
        "case_sensitive": True,
    },
    "BANK_ACCOUNT_IN": {
        # Label-gated – only matched when preceded by account label
        "pattern": r"(?<!\d)(\d{9,18})(?!\d)",
        "risk_level": "HIGH",
        "confidence": 0.72,
        "case_sensitive": True,
    },
    "IFSC": {
        "pattern": r"\b([A-Z]{4})(0)([A-Z0-9]{6})\b",
        "risk_level": "MEDIUM",
        "confidence": 0.97,
        "case_sensitive": False,
    },
    "IBAN": {
        "pattern": r"\b([A-Z]{2}\d{2})\s?(?:[A-Z0-9]{4}\s?){3,7}[A-Z0-9]{1,4}\b",
        "risk_level": "HIGH",
        "confidence": 0.90,
        "case_sensitive": False,
    },
    "SWIFT_BIC": {
        "pattern": r"\b([A-Z]{4})([A-Z]{2})([A-Z0-9]{2})([A-Z0-9]{3})?\b",
        "risk_level": "MEDIUM",
        "confidence": 0.82,
        "case_sensitive": False,
    },

    # ── Contact ───────────────────────────────────────────────────────────────
    "PHONE_IN": {
        "pattern": r"\b(?:(?:\+|0{0,2})91[\s\-]?)?[6-9]\d{9}\b",
        "risk_level": "MEDIUM",
        "confidence": 0.87,
        "case_sensitive": True,
    },
    "PHONE_INTL": {
        "pattern": r"\+(?!91\b)\d{1,3}[\s\-]?\(?\d{1,4}\)?[\s\-]?\d{1,4}[\s\-]?\d{1,9}",
        "risk_level": "MEDIUM",
        "confidence": 0.82,
        "case_sensitive": True,
    },
    "EMAIL": {
        "pattern": r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b",
        "risk_level": "MEDIUM",
        "confidence": 0.98,
        "case_sensitive": True,
    },

    # ── Dates ─────────────────────────────────────────────────────────────────
    "DATE_OF_BIRTH": {
        "pattern": (
            r"\b(?:"
            r"(?:0?[1-9]|[12]\d|3[01])[\/\-\.](?:0?[1-9]|1[0-2])[\/\-\.](?:19|20)\d{2}"
            r"|(?:19|20)\d{2}[\/\-\.](?:0?[1-9]|1[0-2])[\/\-\.](?:0?[1-9]|[12]\d|3[01])"
            r"|(?:0?[1-9]|[12]\d|3[01])\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:19|20)\d{2}"
            r")\b"
        ),
        "risk_level": "MEDIUM",
        "confidence": 0.88,
        "case_sensitive": False,
    },

    # ── Location ──────────────────────────────────────────────────────────────
    "PINCODE_IN": {
        "pattern": r"(?<!\d)([1-9]\d{5})(?!\d)",
        "risk_level": "LOW",
        "confidence": 0.75,
        "case_sensitive": True,
    },

    # ── US IDs ────────────────────────────────────────────────────────────────
    "SSN_US": {
        "pattern": r"\b(\d{3})[\s\-](\d{2})[\s\-](\d{4})\b",
        "risk_level": "HIGH",
        "confidence": 0.90,
        "case_sensitive": True,
    },

    # ── Network ───────────────────────────────────────────────────────────────
    "IP_ADDRESS": {
        "pattern": r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b",
        "risk_level": "LOW",
        "confidence": 0.95,
        "case_sensitive": True,
    },
}

# Patterns that need a label in context to avoid false positives
_LABEL_GATED: Dict[str, List[str]] = {
    "BANK_ACCOUNT_IN": [
        "account", "a/c", "acc no", "acct", "bank account",
        "savings", "current account", "account no", "account number",
    ],
    "SWIFT_BIC": ["swift", "bic", "bank code"],
    "DRIVING_LICENCE": [
        "driving licence", "driving license", "dl no",
        "dl number", "licence no", "license no",
    ],
}
_LABEL_WINDOW = 120  # chars before match to search

# Span types that absorb contained weaker matches
_ABSORBING_TYPES = {
    "AADHAAR", "AADHAAR_VID", "CREDIT_CARD",
    "BANK_ACCOUNT_IN", "SSN_US", "IBAN", "MRZ_LINE",
}

RISK_WEIGHTS: Dict[str, int] = {
    "CRITICAL": 10, "HIGH": 5, "MEDIUM": 2, "LOW": 1,
}


# ══════════════════════════════════════════════════════════════════════════════
# 2.  BLOCKLIST
# ══════════════════════════════════════════════════════════════════════════════

BLOCKLIST: set = {
    "UNIQUE IDENTIFICATION AUTHORITY OF INDIA",
    "GOVERNMENT OF INDIA", "GOVT OF INDIA", "GOVT. OF INDIA",
    "INCOME TAX DEPARTMENT", "INCOMETAX DEPARTMENT",
    "PERMANENT ACCOUNT NUMBER", "PERMANENT ACCOUNT NUMBER CARD",
    "MERA AADHAAR MERI PEHCHAN", "MERA AADHAR",
    "AADHAAR IS A PROOF OF IDENTITY", "NOT OF CITIZENSHIP",
    "HELP@UIDAI.GOV.IN", "WWW.UIDAI.GOV.IN",
    "AADHAAR", "AADHAR", "VIRTUAL ID", "VID", "UID",
    "ENROLMENT NO", "DATE OF BIRTH", "DOB",
    "MALE", "FEMALE", "TRANSGENDER",
    "SIGNATURE", "FATHER'S NAME", "FATHER NAME",
    "MOTHER'S NAME", "MOTHERS NAME",
    "ADDRESS", "DISTRICT", "STATE", "PIN CODE", "PINCODE",
    "POST OFFICE", "VILLAGE", "SON OF", "DAUGHTER OF", "WIFE OF",
    "YEAR OF BIRTH", "PLACE OF BIRTH",
    "DEPARTMENT", "IDENTIFICATION", "CITIZENSHIP", "DECLARATION",
    "REPUBLIC OF INDIA", "TAX DEPARTMENT",
    "VALID THRU", "VALID THROUGH", "EXPIRY", "EXPIRES",
    "CARDHOLDER", "CARD NUMBER", "MEMBER SINCE",
    "AUTHORIZED SIGNATURE", "NOT VALID UNLESS SIGNED",
    "IMMIGRATION", "NATIONALITY", "PLACE OF ISSUE",
    "DATE OF ISSUE", "DATE OF EXPIRY",
    "MINISTRY OF", "ISSUED BY", "REPUBLIC OF",
}

_NOISE_WORDS: set = {
    "CARD", "NUMBER", "DEPT", "DEPARTMENT", "GOVT", "INDIA",
    "INCOME", "TAX", "PERMANENT", "SERVICE", "ACCOUNT",
    "IDENTITY", "AUTHORITY", "UNIQUE", "IDENTIFICATION",
    "MERA", "PEHCHAN", "CITIZENSHIP", "PROOF",
    "ADDRESS", "DISTRICT", "MANDAL", "PINCODE", "VILLAGE", "STATE",
    "ENROLMENT", "SIGNATURE", "DECLARATION", "BANK", "BRANCH",
    "HOLDER", "MEMBER", "ISSUED", "ISSUER", "VALID",
    # Institutional / label words that appear near names on ID cards
    "AUTHORISED", "AUTHORIZED", "SIGNATORY", "OFFICER", "PRINCIPAL",
    "DIRECTOR", "SECRETARY", "REGISTRAR", "COMMISSIONER",
    "INSTITUTE", "INSTITUTION", "UNIVERSITY", "COLLEGE", "SCHOOL",
    "MANAGEMENT", "TECHNOLOGY", "ENGINEERING", "SCIENCE", "ARTS",
    "ACCREDITED", "APPROVED", "CERTIFIED", "AFFILIATED",
    "ROLL", "REG", "REGISTRATION", "CERTIFICATE", "DEGREE",
    "NAAC", "NBA", "AICTE", "UGC", "AUTONOMOUS",
    "EMPLOYEE", "EMPLOYER", "DESIGNATION", "POST", "GRADE",
    "DIVISION", "OFFICE", "CENTRE", "CENTER", "HQ", "HEAD",
    "REPUBLIC", "MINISTRY", "NATIONAL", "REGIONAL", "ZONAL",
}


# ══════════════════════════════════════════════════════════════════════════════
# 3.  NOISE / QUALITY FILTERS
# ══════════════════════════════════════════════════════════════════════════════

_GARBAGE_RE = re.compile(r"[^\x00-\x7F\u0900-\u097F\s]")


def _is_ocr_noise(text: str) -> bool:
    s = text.strip()
    if not s or len(s) < 2:
        return True
    garbage = len(_GARBAGE_RE.findall(s))
    if garbage > 0 and garbage / len(s) > 0.25:
        return True
    if not re.search(r"[a-zA-Z0-9]", s):
        return True
    if re.match(r"^[<>\[\]{}|\\\/]{1,5}$", s):
        return True
    return False


def _has_label_context(text: str, match_start: int, labels: List[str]) -> bool:
    ctx = text[max(0, match_start - _LABEL_WINDOW): match_start].lower()
    return any(lbl in ctx for lbl in labels)


# Name quality checks
_NAME_STOP_WORDS = {
    "AUTHORISED", "AUTHORIZED", "SIGNATORY", "INSTITUTE", "UNIVERSITY",
    "COLLEGE", "SCHOOL", "TECHNOLOGY", "MANAGEMENT", "ACCREDITED",
    "OFFICER", "DIRECTOR", "PRINCIPAL", "SECRETARY", "REGISTRAR",
    "ROLL", "NAAC", "NBA", "AICTE", "AUTONOMOUS", "APPROVED",
    "CERTIFIED", "AFFILIATED", "EMPLOYEE", "EMPLOYER", "CERTIFICATE",
    "GOVERNMENT", "REPUBLIC", "MINISTRY", "NATIONAL", "DEPARTMENT",
    "AUTHORITY", "COMMISSION", "BOARD", "CORPORATION", "LIMITED",
}


def _is_valid_name(name: str) -> bool:
    """
    Returns True only if `name` looks like a real person or org name
    after OCR processing.

    Rejects:
    - Names shorter than 4 chars total
    - Names where any individual word is a single letter (OCR split artifact)
    - Names containing institutional/label stop-words
    - Names where >40% of characters are digits
    - Names that are pure noise (all special chars)
    - Names where OCR produced illegal patterns (word followed by space + 1-2 chars)
    """
    s = name.strip()
    if not s or len(s) < 4:
        return False

    words = s.split()
    # Reject if any word is a single character (OCR split: "Sam ie" → ["Sam", "ie"])
    # Allow initials only if the full name has 2+ words and at least one long word
    long_words = [w for w in words if len(w) >= 3]
    tiny_words  = [w for w in words if len(w) == 1]
    two_char    = [w for w in words if len(w) == 2]

    if not long_words:
        return False  # No word ≥ 3 chars — all fragments
    if tiny_words and len(long_words) == 0:
        return False
    # If we have a 1- or 2-char fragment AND no long word ≥ 4 chars → likely OCR split
    four_char = [w for w in words if len(w) >= 4]
    if (tiny_words or two_char) and not four_char:
        return False

    # Reject if any word matches institutional stop words
    upper_words = {w.upper() for w in words}
    if upper_words & _NAME_STOP_WORDS:
        return False

    # Reject if noise words present
    if any(w in _NOISE_WORDS for w in upper_words):
        return False

    # Reject high-digit content
    digit_ratio = sum(c.isdigit() for c in s) / len(s)
    if digit_ratio > 0.35:
        return False

    # Must contain at least one alpha char in long words
    if not any(c.isalpha() for w in long_words for c in w):
        return False

    return True


# ══════════════════════════════════════════════════════════════════════════════
# 4.  DOCUMENT-TYPE STRUCTURED PARSERS
# ══════════════════════════════════════════════════════════════════════════════

def _detect_document_type(text: str) -> str:
    t = text.upper()
    if any(k in t for k in ("UIDAI", "AADHAAR", "AADHAR", "MERA AADHAAR", "UNIQUE IDENTIFICATION")):
        return "aadhaar"
    if any(k in t for k in ("INCOME TAX DEPARTMENT", "PERMANENT ACCOUNT NUMBER", "PAN CARD")):
        return "pan"
    if any(k in t for k in ("PASSPORT", "REPUBLIC OF INDIA", "IMMIGRATION", "NATIONALITY", "MRZ")):
        return "passport"
    if any(k in t for k in ("VISA", "MASTERCARD", "RUPAY", "AMEX", "AMERICAN EXPRESS",
                             "VALID THRU", "CARDHOLDER", "DEBIT CARD", "CREDIT CARD")):
        return "credit_card"
    if any(k in t for k in ("IFSC", "MICR", "ACCOUNT NO", "ACCOUNT NUMBER", "PASSBOOK",
                             "BANK STATEMENT", "SAVINGS ACCOUNT", "CURRENT ACCOUNT")):
        return "bank"
    return "general"


# ── Aadhaar ───────────────────────────────────────────────────────────────────
_AAD_NAME  = re.compile(r"^[ \t]*([A-Z][a-z]+(?: [A-Z][a-z]+){1,4})[ \t]*$", re.MULTILINE)
_AAD_DOB   = re.compile(r"(?:DOB|Date\s+of\s+Birth|Year\s+of\s+Birth)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4})", re.IGNORECASE)
_AAD_ADDR  = re.compile(r"(?:Address|Addr)[:\s]+([\s\S]{10,250}?)(?:\n\n|\Z)", re.IGNORECASE)


def _parse_aadhaar(text: str) -> List[Dict]:
    out = []

    # 1. Name: first Title-Case line that isn't a label
    for m in _AAD_NAME.finditer(text):
        n = m.group(1).strip()
        if len(n) >= 4 and _is_valid_name(n):
            out.append(_mk("PERSON_NAME", n, m.start(1), m.end(1), 0.92, "LOW", "AADHAAR_STRUCT"))
            break

    # 2. DOB
    m = _AAD_DOB.search(text)
    if m:
        out.append(_mk("DATE_OF_BIRTH", m.group(1), m.start(1), m.end(1), 0.95, "MEDIUM", "AADHAAR_STRUCT"))

    # 3. Address
    m = _AAD_ADDR.search(text)
    if m:
        addr = m.group(1).strip().replace("\n", ", ")
        if len(addr) > 10 and not _is_ocr_noise(addr):
            out.append(_mk("ADDRESS", addr, m.start(1), m.end(1), 0.88, "MEDIUM", "AADHAAR_STRUCT"))

    # 4. Aadhaar OCR correction: digits/letters commonly swapped
    #    Look for 12-char sequences (with spaces) where O→0, I→1, S→5, B→8
    _l2d = {"O": "0", "I": "1", "S": "5", "B": "8"}
    for m in re.finditer(r"\b[2-9OI][\dOISB]{3}[\s.\-]?[\dOISB]{4}[\s.\-]?[\dOISB]{4}\b", text):
        raw = re.sub(r"[\s.\-]", "", m.group(0))
        corrected = "".join(_l2d.get(c, c) for c in raw.upper())
        if re.match(r"^[2-9]\d{11}$", corrected):
            # Only add if not already detected
            if not any(r["pii_type"] == "AADHAAR" and corrected in r["detected_value"].replace(" ", "") for r in out):
                out.append(_mk("AADHAAR", corrected, m.start(), m.end(), 0.85, "HIGH", "AADHAAR_OCR_FIX"))

    # 5. C/O (Care Of) Name detection
    for m in re.finditer(r"(?:C/O|Care\s+of)[:\s]+([A-Z][A-Za-z\s]{2,30})", text, re.IGNORECASE):
        name = m.group(1).strip()
        if _is_valid_name(name):
            out.append(_mk("PERSON_NAME", name, m.start(1), m.end(1), 0.90, "LOW", "AADHAAR_STRUCT"))

    return out


# ── PAN Card ──────────────────────────────────────────────────────────────────
_PAN_NAME  = re.compile(r"(?:^|Name)[:\s]+([A-Z][A-Za-z\s]{2,40}?)(?:\n|$)", re.MULTILINE)
_PAN_FNAME = re.compile(r"Father['\s]s?\s*Name[:\s]+([A-Z][A-Za-z\s]{2,40}?)(?:\n|$)", re.IGNORECASE)
_PAN_DOB   = re.compile(r"(?:Date\s+of\s+Birth|DOB)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})", re.IGNORECASE)


def _parse_pan(text: str) -> List[Dict]:
    out = []
    
    pan_labels = [
        (r"\bName\b", "PERSON_NAME"),
        (r"\bFather['\s]s?\s*Name\b", "PERSON_NAME"),
        (r"\bFather Name\b", "PERSON_NAME"),
    ]
    
    for pattern, pii_type in pan_labels:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            # PAN names can be on the same line or the NEXT line
            # We search a larger window and look for the first valid-looking name candidate
            search_area = text[match.end():match.end()+150]
            
            # 1. Clean line breaks to keep name segments together but split noise
            # PAN names often look like:
            #   Name
            #   SURESH KUMAR
            # So we look for the next ALL CAPS line that isn't a label.
            lines = search_area.split('\n')
            for line in lines:
                val = line.strip()
                if not val: continue
                
                # Filter out labels that might have been caught in the split
                if any(k in val.upper() for k in ["NAME", "DOB", "DATE", "BIRTH", "DEPT", "INCOME"]):
                    continue
                
                # Heuristic: Names on PAN are usually 4+ chars, mostly uppercase, and pass name quality check
                if len(val) >= 4:
                    upper_ratio = sum(1 for c in val if c.isupper()) / len(val)
                    if upper_ratio > 0.5 and _is_valid_name(val):
                        out.append(_mk(pii_type, val, 
                                     match.end() + search_area.find(line), 
                                     match.end() + search_area.find(line) + len(line),
                                     0.96, "LOW", "PAN_STRUCT"))
                        break  # Found name for this label, stop searching
                        
    m = _PAN_DOB.search(text)
    
    # 2. Heuristic correction for PAN OCR noise
    # PAN Card numbers are exactly 10 chars: 5 letters, 4 digits, 1 letter
    words = text.split()
    for word in words:
        clean_word = word.strip(".,()[]{}")
        if len(clean_word) == 10:
            candidate = list(clean_word.upper())
            # First 5 should be letters
            for i in range(5):
                if candidate[i].isdigit():
                    mapping = {"1":"I", "0":"O", "5":"S", "2":"Z", "8":"B"}
                    candidate[i] = mapping.get(candidate[i], candidate[i])
            # Next 4 should be digits
            for i in range(5, 9):
                if candidate[i].isalpha():
                    mapping = {"I":"1", "O":"0", "S":"5", "Z":"2", "B":"8"}
                    candidate[i] = mapping.get(candidate[i], candidate[i])
            # Last 1 should be a letter
            if candidate[9].isdigit():
                mapping = {"1":"I", "0":"O", "5":"S", "2":"Z", "8":"B"}
                candidate[9] = mapping.get(candidate[9], candidate[9])
                
            corrected = "".join(candidate)
            if re.match(r"^[A-Z]{5}\d{4}[A-Z]$", corrected):
                if not any(r["detected_value"] == clean_word for r in out):
                    start = text.find(word)
                    out.append(_mk("PAN", clean_word, start, start + len(word), 0.85, "HIGH", "PAN_FUZZY"))
    
    # 3. Label-less Name detection (PAN Cards often have name as the only major text block above DOB)
    if not any(r["pii_type"] == "PERSON_NAME" for r in out):
        lines = text.split('\n')
        for i, line in enumerate(lines):
            val = line.strip()
            # If line is ALL CAPS and long enough, and next few lines contain DOB or PAN pattern
            if len(val) >= 5 and val.isupper() and _is_valid_name(val):
                # Check surrounding context for PAN keywords
                context = "\n".join(lines[max(0, i-2):i+5]).upper()
                if any(k in context for k in ["INCOME", "TAX", "PERMANENT", "ACCOUNT", "CARD"]):
                    out.append(_mk("PERSON_NAME", val, text.find(line), text.find(line) + len(line), 0.82, "LOW", "PAN_HEURISTIC"))
                    break

    return out


# ── Passport ──────────────────────────────────────────────────────────────────
_PP_SURNAME = re.compile(r"(?:Surname|Last\s+Name)[:\s/]+([A-Z][A-Za-z\s\-]{1,40})(?:\n|$)")
_PP_GIVEN   = re.compile(r"(?:Given\s+Names?|First\s+Name)[:\s/]+([A-Z][A-Za-z\s\-]{1,40})(?:\n|$)")
_PP_DOB     = re.compile(r"(?:Date\s+of\s+Birth|DOB|Born)[:\s/]+(\d{1,2}\s+\w+\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})", re.IGNORECASE)
_PP_EXPIRY  = re.compile(r"(?:Date\s+of\s+Expiry|Expiry|Expiration|Valid\s+Until)[:\s/]+(\d{1,2}\s+\w+\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})", re.IGNORECASE)
_PP_NO      = re.compile(r"Passport\s+(?:No\.?|Number)[:\s]+([A-Z]\d{7})\b", re.IGNORECASE)
_PP_NATION  = re.compile(r"Nationality[:\s]+([A-Z][A-Za-z\s]{2,30})(?:\n|$)")


def _parse_passport(text: str) -> List[Dict]:
    out = []
    for pat, pt, conf, risk, meth in [
        (_PP_SURNAME, "PERSON_NAME", 0.93, "LOW",    "PASSPORT_STRUCT"),
        (_PP_GIVEN,   "PERSON_NAME", 0.93, "LOW",    "PASSPORT_STRUCT"),
        (_PP_DOB,     "DATE_OF_BIRTH",0.95,"MEDIUM", "PASSPORT_STRUCT"),
        (_PP_EXPIRY,  "DATE_PII",    0.90, "LOW",    "PASSPORT_STRUCT"),
        (_PP_NO,      "PASSPORT_IN", 0.97, "HIGH",   "PASSPORT_STRUCT"),
        (_PP_NATION,  "NATIONALITY", 0.80, "LOW",    "PASSPORT_STRUCT"),
    ]:
        m = pat.search(text)
        if m:
            v = m.group(1).strip()
            if len(v) >= 2 and not _is_ocr_noise(v):
                out.append(_mk(pt, v, m.start(1), m.end(1), conf, risk, meth))
    return out


# ── Credit / Debit Card ───────────────────────────────────────────────────────
_CC_NAME   = re.compile(r"(?:Cardholder|Card\s+Holder|Name\s+on\s+Card)[:\s]+([A-Z][A-Za-z\s\-\.]{3,40})(?:\n|$)", re.IGNORECASE)
_CC_EXPIRY = re.compile(r"(?:Valid\s+Thru|Valid\s+Through|Expires?|Expiry)[:\s]+(0[1-9]|1[0-2])[\/\s\-](\d{2,4})", re.IGNORECASE)


def _parse_credit_card(text: str) -> List[Dict]:
    out = []
    m = _CC_NAME.search(text)
    if m:
        n = m.group(1).strip()
        if len(n) >= 4 and not any(w in n.upper().split() for w in _NOISE_WORDS):
            out.append(_mk("PERSON_NAME", n, m.start(1), m.end(1), 0.88, "LOW", "CC_STRUCT"))
    m = _CC_EXPIRY.search(text)
    if m:
        out.append(_mk("CARD_EXPIRY", f"{m.group(1)}/{m.group(2)}", m.start(), m.end(), 0.93, "MEDIUM", "CC_STRUCT"))
    return out


# ── Bank Document ─────────────────────────────────────────────────────────────
_BK_ACNO = re.compile(r"(?:Account\s+(?:No\.?|Number)|A/?C\s+No\.?|Acct\.?\s+No\.?)[:\s]+(\d{9,18})", re.IGNORECASE)
_BK_IFSC = re.compile(r"IFSC[:\s]+([A-Z]{4}0[A-Z0-9]{6})", re.IGNORECASE)
_BK_NAME = re.compile(r"(?:Account\s+(?:Holder|Name)|Name)[:\s]+([A-Z][A-Za-z\s\.]{3,50})(?:\n|$)", re.IGNORECASE)


def _parse_bank(text: str) -> List[Dict]:
    out = []
    m = _BK_ACNO.search(text)
    if m:
        out.append(_mk("BANK_ACCOUNT_IN", m.group(1), m.start(1), m.end(1), 0.97, "HIGH", "BANK_STRUCT"))
    m = _BK_IFSC.search(text)
    if m:
        out.append(_mk("IFSC", m.group(1), m.start(1), m.end(1), 0.98, "MEDIUM", "BANK_STRUCT"))
    m = _BK_NAME.search(text)
    if m:
        n = m.group(1).strip()
        if len(n) >= 4 and not any(w in n.upper().split() for w in _NOISE_WORDS):
            out.append(_mk("PERSON_NAME", n, m.start(1), m.end(1), 0.90, "LOW", "BANK_STRUCT"))
    return out


# ══════════════════════════════════════════════════════════════════════════════
# 5.  REGEX DETECTION
# ══════════════════════════════════════════════════════════════════════════════

def detect_pii_regex(text: str) -> List[Dict]:
    results: List[Dict] = []

    for pii_type, cfg in PATTERNS.items():
        flags = 0 if cfg.get("case_sensitive", True) else re.IGNORECASE
        for m in re.finditer(cfg["pattern"], text, flags):
            value = m.group(0)
            if _is_ocr_noise(value):
                continue
            if pii_type in _LABEL_GATED:
                if not _has_label_context(text, m.start(), _LABEL_GATED[pii_type]):
                    continue
            results.append(_mk(
                pii_type, value,
                m.start(), m.end(),
                cfg["confidence"], cfg["risk_level"],
                "REGEX",
            ))

    # PAN OCR typo correction (digits misread as letters)
    _d2l = {"1": "I", "0": "O", "5": "S", "8": "B"}
    for m in re.finditer(r"\b[0-9A-Z][A-Z0-9]{4}\d{4}[A-Z]\b", text):
        val = list(m.group(0))
        for i in range(5):
            val[i] = _d2l.get(val[i], val[i])
        fixed = "".join(val)
        if re.match(r"^[A-Z]{5}\d{4}[A-Z]$", fixed):
            if not any(r["detected_value"] == fixed and r["pii_type"] == "PAN" for r in results):
                results.append(_mk("PAN", fixed, m.start(), m.end(), 0.87, "HIGH", "REGEX_HEURISTIC"))

    return results


# ══════════════════════════════════════════════════════════════════════════════
# 6.  NER DETECTION
# ══════════════════════════════════════════════════════════════════════════════

_NER_MAP = {
    "PERSON": ("PERSON_NAME", "LOW", 0.80),
    "GPE":    ("LOCATION",    "LOW", 0.75),
    "LOC":    ("ADDRESS",     "LOW", 0.75),
    "ORG":    ("ORGANIZATION","LOW", 0.70),
    "FAC":    ("FACILITY",    "LOW", 0.65),
}


def detect_pii_ner(text: str) -> List[Dict]:
    if not SPACY_AVAILABLE:
        return []

    results: List[Dict] = []
    doc = nlp(text)

    for ent in doc.ents:
        if ent.label_ not in _NER_MAP:
            continue

        pii_type, risk, conf = _NER_MAP[ent.label_]
        clean = ent.text.strip()

        # Fix leading OCR artifact char (e.g. "gRamakrishna" → "Ramakrishna")
        if len(clean) > 3 and clean[0].islower() and clean[1].isupper():
            clean = clean[1:].strip()

        if _is_ocr_noise(clean) or len(clean) < 4:
            continue
        if any(bw in clean.upper() for bw in BLOCKLIST):
            continue

        # High digit or non-ASCII ratio → garbage
        if sum(c.isdigit() for c in clean) / len(clean) > 0.35:
            continue
        if sum(ord(c) > 127 for c in clean) / len(clean) > 0.30:
            continue

        # Apply strict name quality check for person names and organisations
        if pii_type == "PERSON_NAME":
            if not _is_valid_name(clean):
                continue
            # Require at least one word with 3+ alpha chars (rejects "Kl Pen" etc.)
            words = clean.split()
            if not any(sum(c.isalpha() for c in w) >= 3 for w in words):
                continue

        elif pii_type == "ORGANIZATION":
            # For organisations, just check noise words
            if any(nw in clean.upper().split() for nw in _NOISE_WORDS):
                continue

        # Name promotion from LOC/ORG: "A. Kumar" style
        if pii_type in ("ADDRESS", "LOCATION", "ORGANIZATION"):
            if re.match(r"^[A-Z]{1,2}[\s\.][A-Z][a-z]+", clean):
                # Only promote if it passes the name check too
                if _is_valid_name(clean):
                    pii_type, conf = "PERSON_NAME", 0.85

        results.append(_mk(pii_type, clean, ent.start_char, ent.end_char, conf, risk, "NER"))

    # S/O, D/O, W/O, C/O heuristic (son of / daughter of / wife of / care of)
    for pref in (r"\bS/O\b", r"\bD/O\b", r"\bW/O\b", r"\bC/O\b", r"\bCare\s+of\b"):
        for m in re.finditer(pref + r"[\s:]+([A-Z][A-Za-z\s]{2,30})(?=\n|,|$)", text, re.IGNORECASE):
            name = m.group(1).strip()
            if _is_valid_name(name):
                results.append(_mk("PERSON_NAME", name, m.start(1), m.end(1), 0.88, "LOW", "HEURISTIC"))

    return results


# ══════════════════════════════════════════════════════════════════════════════
# 7.  DEDUPLICATION
# ══════════════════════════════════════════════════════════════════════════════

def deduplicate_results(results: List[Dict]) -> List[Dict]:
    if not results:
        return []

    # Build absorbing span list
    absorbing = [(r["start"], r["end"]) for r in results if r["pii_type"] in _ABSORBING_TYPES]

    def _absorbed(r: Dict) -> bool:
        if r["pii_type"] not in ("PINCODE_IN", "BANK_ACCOUNT_IN", "PASSPORT_IN", "SSN_US"):
            return False
        return any(a <= r["start"] and r["end"] <= b for a, b in absorbing)

    filtered = [r for r in results if not _absorbed(r)]

    # Spatial dedup (highest confidence wins)
    sorted_r = sorted(filtered, key=lambda x: (-x["confidence"], x["start"]))
    used: List[Tuple[int, int]] = []
    spatial: List[Dict] = []
    for res in sorted_r:
        s, e = res["start"], res["end"]
        if not any(not (e <= us or s >= ue) for us, ue in used):
            spatial.append(res)
            used.append((s, e))

    # Identity dedup (same type + value → merge extra positions)
    final: List[Dict] = []
    seen: Dict[tuple, int] = {}
    for res in sorted(spatial, key=lambda x: x["start"]):
        key = (res["pii_type"], res["detected_value"].strip().upper())
        if key not in seen:
            seen[key] = len(final)
            final.append(res)
        else:
            final[seen[key]].setdefault("other_ranges", []).append((res["start"], res["end"]))

    return final


# ══════════════════════════════════════════════════════════════════════════════
# 8.  RISK SCORING
# ══════════════════════════════════════════════════════════════════════════════

def calculate_risk_score(results: List[Dict]) -> Dict[str, Any]:
    if not results:
        return {"score": 0, "level": "SAFE", "breakdown": {}}

    breakdown: Dict[str, int] = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    total_weight = 0
    for r in results:
        lvl = r["risk_level"]
        breakdown[lvl] = breakdown.get(lvl, 0) + 1
        total_weight += RISK_WEIGHTS.get(lvl, 1)

    max_possible = len(results) * RISK_WEIGHTS["HIGH"]
    score = min(100, int(total_weight / max_possible * 100)) if max_possible else 0

    if score >= 70 or breakdown.get("HIGH", 0) >= 3:
        level = "CRITICAL"
    elif score >= 40 or breakdown.get("HIGH", 0) >= 1:
        level = "HIGH"
    elif score >= 20 or breakdown.get("MEDIUM", 0) >= 2:
        level = "MEDIUM"
    else:
        level = "LOW"

    return {"score": score, "level": level, "breakdown": breakdown}


# ══════════════════════════════════════════════════════════════════════════════
# 9.  FULL PIPELINE
# ══════════════════════════════════════════════════════════════════════════════

# ══════════════════════════════════════════════════════════════════════════════
# 8b.  COORDINATE ATTACHMENT (image word-map → detection bbox)
# ══════════════════════════════════════════════════════════════════════════════

def _attach_coords(detections: List[Dict], word_map: List[Dict]) -> None:
    """
    For each detection, find ALL matching word spans in word_map and attach
    merged bounding boxes.  Handles multi-word PII (names, Aadhaar numbers…).

    The first match bbox is unpacked into top-level x/y/w/h for backward
    compatibility with existing callers.  All matches are stored in ``bboxes``
    (a list of {"x", "y", "w", "h"} dicts) so redact_image can black-out every
    occurrence of the PII value.

    Modifies detections in-place.
    """
    if not word_map:
        return

    tokens = [w["text"].strip() for w in word_map]
    n = len(tokens)

    def _merge_bbox(idxs: List[int]) -> Dict:
        xs  = [word_map[i]["x"] for i in idxs]
        ys  = [word_map[i]["y"] for i in idxs]
        x2s = [word_map[i]["x"] + word_map[i]["w"] for i in idxs]
        y2s = [word_map[i]["y"] + word_map[i]["h"] for i in idxs]
        return {
            "x": min(xs),
            "y": min(ys),
            "w": max(x2s) - min(xs),
            "h": max(y2s) - min(ys),
        }

    def _find_exact_spans(val_tokens: List[str]) -> List[List[int]]:
        """Return every consecutive token window that matches val_tokens."""
        k = len(val_tokens)
        matches: List[List[int]] = []
        for start in range(n - k + 1):
            window = tokens[start: start + k]
            if [t.upper() for t in window] == [t.upper() for t in val_tokens]:
                matches.append(list(range(start, start + k)))
        return matches

    def _find_fuzzy_spans(val_clean: str) -> List[List[int]]:
        """Substring / concat match for numeric PII (Aadhaar, card numbers…)."""
        matches: List[List[int]] = []
        seen_starts: set = set()
        for start in range(n):
            if start in seen_starts:
                continue
            concat = ""
            span: List[int] = []
            for j in range(start, min(start + 8, n)):
                concat += re.sub(r"[\s\-.]", "", tokens[j]).upper()
                span.append(j)
                if val_clean in concat or concat in val_clean:
                    matches.append(list(span))
                    seen_starts.update(span)
                    break
                if len(concat) > len(val_clean) + 4:
                    break
        return matches

    for res in detections:
        val = res["detected_value"].strip()
        val_tokens = val.split()

        # 1. Exact phrase match (all occurrences)
        all_spans = _find_exact_spans(val_tokens)

        # 2. Fallback: fuzzy / numeric match
        if not all_spans:
            val_clean = re.sub(r"[\s\-.]", "", val).upper()
            all_spans = _find_fuzzy_spans(val_clean)

        if all_spans:
            bboxes = [_merge_bbox(span) for span in all_spans]
            res["bboxes"] = bboxes          # all occurrences
            res.update(bboxes[0])           # first occurrence → x/y/w/h (backward compat)


def detect_all_pii(text: str, word_map: List[Dict] = None) -> Dict[str, Any]:
    """
    Full pipeline:
      regex → NER → document-type structured parser → dedup → risk score
    Returns a dict with keys:
      detections, total_found, risk_score, document_type, pii_types_found
    """
    doc_type = _detect_document_type(text)
    logger.info("Detected document type: %s", doc_type)

    regex_results = detect_pii_regex(text)
    ner_results   = detect_pii_ner(text)

    struct_map = {
        "aadhaar":     _parse_aadhaar,
        "pan":         _parse_pan,
        "passport":    _parse_passport,
        "credit_card": _parse_credit_card,
        "bank":        _parse_bank,
    }
    struct_results = struct_map.get(doc_type, lambda _: [])(text)

    all_results = deduplicate_results(regex_results + ner_results + struct_results)
    
    # Attach coordinates if word_map provided (for images)
    if word_map:
        _attach_coords(all_results, word_map)

    risk = calculate_risk_score(all_results)

    return {
        "detections":      all_results,
        "total_found":     len(all_results),
        "risk_score":      risk,
        "document_type":   doc_type,
        "pii_types_found": list({r["pii_type"] for r in all_results}),
    }


# ══════════════════════════════════════════════════════════════════════════════
# 10.  SANITISATION
# ══════════════════════════════════════════════════════════════════════════════

def _all_ranges(detections: List[Dict]) -> List[Tuple[int, int]]:
    ranges = []
    for d in detections:
        ranges.append((d["start"], d["end"]))
        ranges.extend(d.get("other_ranges", []))
    return ranges


def mask_pii(text: str, detections: List[Dict], mask_char: str = "X") -> str:
    chars = list(text)
    for s, e in sorted(_all_ranges(detections), reverse=True):
        chars[s:e] = list(mask_char * (e - s))
    return "".join(chars)


def remove_pii(text: str, detections: List[Dict]) -> str:
    chars = list(text)
    for s, e in sorted(_all_ranges(detections), reverse=True):
        chars[s:e] = list("[REDACTED]")
    return "".join(chars)


# ══════════════════════════════════════════════════════════════════════════════
# 11.  INTERNAL HELPER
# ══════════════════════════════════════════════════════════════════════════════

def _mk(pii_type, val, start, end, confidence, risk_level, method) -> Dict:
    return {
        "pii_type":        pii_type,
        "detected_value":  val,
        "start":           start,
        "end":             end,
        "confidence":      confidence,
        "risk_level":      risk_level,
        "detection_method": method,
    }