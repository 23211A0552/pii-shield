# 🛡️ PII Shield – Smart Detection and Protection of Sensitive Data

A production-ready cybersecurity web application that automatically detects and protects Personally Identifiable Information (PII) in uploaded documents.

---

## 📁 Project Structure

```
pii-shield/
├── frontend/                    # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/          # AppLayout with sidebar navigation
│   │   │   └── ui/              # RiskBadge, RiskScore components
│   │   ├── pages/               # Landing, Login, Register, Dashboard, Upload, ScanResults, Analytics, Admin
│   │   ├── services/            # api.js – all API calls
│   │   ├── firebase/            # config.js – Firebase SDK init
│   │   ├── hooks/               # useAuth.jsx – auth context
│   │   └── utils/               # piiUtils.js helpers
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── vercel.json
│
├── backend/                     # Python FastAPI backend
│   ├── main.py                  # FastAPI app entry point
│   ├── api/
│   │   ├── upload.py            # Document upload + OCR + PII scan
│   │   ├── scan.py              # Mask, remove, download sanitized
│   │   ├── documents.py         # List and get documents
│   │   ├── users.py             # User profile endpoints
│   │   └── admin.py             # Admin stats and management
│   ├── services/
│   │   ├── pii_detector.py      # Regex + spaCy NER PII detection
│   │   ├── ocr_service.py       # Tesseract OCR text extraction
│   │   └── firebase_service.py  # Firestore + Storage helpers
│   ├── utils/
│   │   ├── auth_middleware.py   # Firebase token verification
│   │   └── encryption.py       # AES-256-GCM encryption
│   ├── models/
│   │   └── schemas.py           # Pydantic data models
│   ├── requirements.txt
│   └── render.yaml              # Render deployment config
│
├── firebase/
│   ├── firestore.rules          # Firestore security rules
│   ├── firestore.indexes.json   # Composite indexes
│   └── storage.rules            # Storage security rules
│
├── firebase.json                # Firebase CLI config
└── README.md
```

---

## 🚀 Features

| Feature | Details |
|---|---|
| **PII Detection** | Aadhaar, PAN, Phone, Email, Credit Card, Bank Account, IFSC, Passport, Names, Addresses |
| **AI Engine** | Hybrid: Regex patterns + spaCy Named Entity Recognition |
| **Risk Scoring** | Critical / High / Medium / Low / Safe classification with numeric score |
| **OCR Support** | Images (JPG, PNG, BMP), PDFs, Word docs, plain text |
| **Masking** | Replace PII with XXXX or [REDACTED] |
| **Download** | Export sanitized document as .txt |
| **Auth** | Firebase Email/Password + Google OAuth |
| **Analytics** | Risk distribution pie, PII type bar chart, per-document history |
| **Admin Panel** | All documents, users, activity logs, system stats |
| **Encryption** | AES-256-GCM for sensitive data |
| **Security** | Firebase token verification middleware on all routes |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion |
| Backend | Python 3.11+, FastAPI, Uvicorn |
| Database | Firebase Firestore |
| Auth | Firebase Authentication (Email + Google) |
| Storage | Firebase Storage |
| OCR | Tesseract OCR, PyPDF2, python-docx |
| AI/NLP | Regex patterns, spaCy en_core_web_sm |
| Charts | Recharts |
| Deployment | Frontend → Vercel, Backend → Render |

---

## ⚙️ Installation

### Prerequisites

- **Node.js** 18+
- **Python** 3.11+
- **Tesseract OCR** installed on system
- **Firebase** project created

### 1. Install Tesseract OCR

```bash
# Ubuntu/Debian
sudo apt-get install tesseract-ocr

# macOS
brew install tesseract

# Windows
# Download installer from: https://github.com/UB-Mannheim/tesseract/wiki
```

### 2. Clone / Copy the project

```bash
cd pii-shield
```

### 3. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/) → Create project
2. Enable **Authentication** → Email/Password + Google
3. Create **Firestore Database** (production mode)
4. Enable **Storage**
5. **Service Account**: Project Settings → Service Accounts → Generate New Private Key → save as `firebase-service-account.json`
6. Deploy security rules:

```bash
npm install -g firebase-tools
firebase login
firebase init     # select Firestore + Storage
firebase deploy --only firestore:rules,storage
```

### 4. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

Create `backend/.env`:
```env
FIREBASE_CREDENTIALS_PATH=./firebase-service-account.json
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
ALLOWED_ORIGINS=http://localhost:5173
```

Or use JSON directly:
```env
FIREBASE_CREDENTIALS_JSON={"type":"service_account","project_id":"..."}
```

### 5. Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env`:
```env
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=xxx
VITE_FIREBASE_APP_ID=xxx
VITE_API_URL=http://localhost:8000/api
```

---

## ▶️ Run Locally

**Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
# API docs available at http://localhost:8000/docs
```

**Frontend (new terminal):**
```bash
cd frontend
npm run dev
# App available at http://localhost:5173
```

---

## 🌐 Deployment

### Frontend → Vercel

1. Push `frontend/` to GitHub
2. Import project in [vercel.com](https://vercel.com)
3. Set all `VITE_*` environment variables in Vercel dashboard
4. Deploy — Vercel auto-detects Vite

### Backend → Render

1. Push `backend/` to GitHub
2. Create **Web Service** on [render.com](https://render.com)
3. Set:
   - **Build Command**: `pip install -r requirements.txt && python -m spacy download en_core_web_sm`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables in Render dashboard (FIREBASE_CREDENTIALS_JSON etc.)
5. After deploy, update frontend `VITE_API_URL` to your Render URL
6. Update backend `ALLOWED_ORIGINS` to your Vercel URL

---

## 🔐 PII Types Detected

| PII Type | Pattern | Risk Level |
|---|---|---|
| Aadhaar Number | 12-digit format | 🔴 HIGH |
| PAN Card | AAAAA9999A format | 🔴 HIGH |
| Credit Card | Major card networks | 🔴 HIGH |
| Bank Account | 9-18 digit numbers | 🔴 HIGH |
| Passport | Indian passport format | 🔴 HIGH |
| Phone Number | Indian mobile format | 🟡 MEDIUM |
| Email Address | RFC-compliant | 🟡 MEDIUM |
| IFSC Code | AAAA0XXXXXX format | 🟡 MEDIUM |
| Date of Birth | DD/MM/YYYY variants | 🟡 MEDIUM |
| Person Names | spaCy NER | 🟢 LOW |
| Addresses/Locations | spaCy NER | 🟢 LOW |
| Organizations | spaCy NER | 🟢 LOW |

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/upload/` | Upload and scan document |
| GET | `/api/documents/` | List user documents |
| GET | `/api/documents/:id` | Get document details |
| POST | `/api/scan/mask` | Mask/remove PII |
| POST | `/api/scan/download-sanitized` | Download sanitized file |
| POST | `/api/scan/rescan` | Re-scan text |
| GET | `/api/users/me` | Get current user |
| POST | `/api/users/profile` | Update profile |
| GET | `/api/admin/stats` | Admin statistics |
| GET | `/api/admin/documents` | All documents (admin) |
| GET | `/api/admin/users` | All users (admin) |
| GET | `/api/admin/logs` | Activity logs (admin) |

All routes require `Authorization: Bearer <firebase_token>` header.

---

## 🗄️ Firestore Schema

```
users/{userId}
  name, email, createdAt

documents/{documentId}
  userId, fileName, fileUrl, storagePath, contentType, fileSize,
  scanStatus, riskLevel, riskScore, totalPiiFound, piiTypesFound,
  extractedText, uploadedAt

scan_results/{resultId}
  documentId, detections[], riskScore{}, scannedAt

activity_logs/{logId}
  userId, action, metadata{}, timestamp
```

---

## 🤝 Contributing

1. Fork the repo
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

MIT License – see LICENSE file for details.
