import hmac
import hashlib
import time
from fastapi import Request, HTTPException, Depends
from app.config import settings
from app.redis_client import get_redis

async def verify_hmac_signature(request: Request) -> None:
    """
    Enforce HMAC request signing on internal endpoints.
    Formula: Signature = HMAC_SHA256(APP_ENCRYPTION_KEY, body + timestamp + nonce)
    """
    signature = request.headers.get("X-Signature")
    timestamp_str = request.headers.get("X-Timestamp")
    nonce = request.headers.get("X-Nonce")

    if not signature or not timestamp_str or not nonce:
        raise HTTPException(status_code=401, detail="Header de sécurité HMAC manquant")

    # 1. Verify timestamp freshness (|current_time - timestamp| < 30s)
    try:
        req_time = float(timestamp_str)
        curr_time = time.time()
        if abs(curr_time - req_time) > 30.0:
            raise HTTPException(status_code=401, detail="Requête expirée (>30s)")
    except ValueError:
        raise HTTPException(status_code=401, detail="Timestamp invalide")

    # 2. Replay protection (check nonce uniqueness in Redis)
    redis_client = await get_redis()
    nonce_key = f"nonce:{nonce}"
    # setnx returns True if key was set (meaning it didn't exist)
    is_new = await redis_client.set(nonce_key, "1", ex=60, nx=True)
    if not is_new:
        raise HTTPException(status_code=401, detail="Attaque par rejeu détectée (nonce expiré/déjà utilisé)")

    # 3. Read body and verify signature
    body = await request.body()
    # Decode body if binary
    body_str = body.decode("utf-8")

    message = f"{body_str}{timestamp_str}{nonce}".encode("utf-8")
    secret = settings.APP_ENCRYPTION_KEY.encode("utf-8")
    
    expected_signature = hmac.new(secret, message, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_signature, signature):
        raise HTTPException(status_code=401, detail="Signature HMAC invalide")

def sign_request(body_str: str, secret: str) -> tuple:
    """Helper to generate headers for HMAC signed requests."""
    import uuid
    nonce = str(uuid.uuid4())
    timestamp = str(time.time())
    message = f"{body_str}{timestamp}{nonce}".encode("utf-8")
    signature = hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()
    return signature, timestamp, nonce

