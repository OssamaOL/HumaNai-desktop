from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from app.middleware.security import SecurityHeadersMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.config import settings
from app.middleware.firebase_auth import init_firebase
import os
from app.routers import (
    auth,
    employees,
    absences,
    assistant,
    dashboard,
    engagement,
    alerts,
    supervision,
    audit,
    users,
    documents,
    onboarding,
    offboarding,
    admin,
    internal_api,
)

# Initialiser Firebase
init_firebase()

app = FastAPI(
    title="HumanAI Backend",
    version=settings.APP_VERSION,
    description="Backend API for HumanAI Platform",
)

# Security Headers Middleware
app.add_middleware(SecurityHeadersMiddleware)

# Rate Limiting Middleware (100 requests per minute)
app.add_middleware(RateLimitMiddleware, limit=100, window=60)


# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include Routers with global /api/v1 prefix
app.include_router(auth.router, prefix="/api/v1")
app.include_router(employees.router, prefix="/api/v1")
app.include_router(absences.router, prefix="/api/v1")
app.include_router(assistant.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(engagement.router, prefix="/api/v1")
app.include_router(alerts.router, prefix="/api/v1")
app.include_router(supervision.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(onboarding.router, prefix="/api/v1")
app.include_router(offboarding.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(internal_api.router)

from prometheus_fastapi_instrumentator import Instrumentator

# Instrument FastAPI and expose /metrics endpoint for Prometheus scraping
Instrumentator().instrument(app).expose(app)

@app.get("/")
async def root():
    return {
        "status": "healthy",
        "app": "HumanAI Backend",
        "version": settings.APP_VERSION,
        "env": settings.APP_ENV,
    }

@app.get("/test", response_class=HTMLResponse)
async def get_test_page():
    path = os.path.join(os.path.dirname(__file__), "..", "test_auth.html")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>Test page not found</h1>", status_code=404)
