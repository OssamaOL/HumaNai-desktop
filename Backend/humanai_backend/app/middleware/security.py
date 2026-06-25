from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request, Response

# Paths that need a relaxed CSP so Swagger UI can load its CDN assets
DOCS_PATHS = {"/docs", "/redoc", "/openapi.json"}

# Strict CSP for all normal API routes
STRICT_CSP = "default-src 'self'; frame-ancestors 'none';"

# Relaxed CSP only for the Swagger/ReDoc pages
# Allows the CDN scripts, styles, and images that FastAPI docs depend on
DOCS_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "img-src 'self' data: https://fastapi.tiangolo.com https://cdn.jsdelivr.net; "
    "font-src 'self' https://cdn.jsdelivr.net; "
    "frame-ancestors 'none';"
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to inject HTTP security headers protecting against XSS, clickjacking, and MIME sniffing.
    Uses a relaxed CSP for /docs and /redoc so Swagger UI loads correctly,
    and a strict CSP for all other routes.
    """
    async def dispatch(self, request: Request, call_next) -> Response:
        response: Response = await call_next(request)

        # Prevent Clickjacking (framing)
        response.headers["X-Frame-Options"] = "DENY"

        # Prevent MIME Sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Force Enable XSS Auditor
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Enforce HTTPS (HSTS) - set to 1 year
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Set Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Apply relaxed CSP for docs pages, strict CSP everywhere else
        if request.url.path in DOCS_PATHS:
            response.headers["Content-Security-Policy"] = DOCS_CSP
        else:
            response.headers["Content-Security-Policy"] = STRICT_CSP

        return response
