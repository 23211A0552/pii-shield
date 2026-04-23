"""
PII Shield – FastAPI Backend
Main application entry point
"""
import os
import uvicorn
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router
from api.admin_routes import admin_router
from services.firebase_service import get_firebase_app

app = FastAPI(
    title="PII Shield API",
    description="Smart Detection and Protection of Sensitive Data",
    version="1.0.0"
)

# CORS – allow frontend origins
# Use ALLOWED_ORIGINS env var in production (comma-separated list)
_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5173"
)
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # This ensures CORS headers are present even on errors
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers={
            "Access-Control-Allow-Origin": "http://localhost:5173",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

app.include_router(router, prefix="/api")
app.include_router(admin_router, prefix="/api/admin")

@app.on_event("startup")
async def startup_event():
    """Eagerly initialize Firebase so the first request doesn't race."""
    try:
        get_firebase_app()
        print("[startup] Firebase initialized OK")
    except Exception as e:
        print(f"[startup] Firebase init failed (check credentials): {e}")

@app.get("/health")
async def health():
    return {"status": "ok", "service": "PII Shield API"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
