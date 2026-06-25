import os
from app.redis_client import get_redis

DEFAULT_FLAGS = {
    "enable_llm_generation": True,
    "enable_manager_approval": True,
    "enable_pdf_signature": True,
}

async def get_flag(name: str) -> bool:
    """Retrieve runtime feature flag status (checks Redis dynamic flags first)."""
    try:
        r = await get_redis()
        val = await r.get(f"flag:{name}")
        if val is not None:
            return val.decode("utf-8").lower() == "true" if isinstance(val, bytes) else str(val).lower() == "true"
    except Exception:
        pass
    
    # Fallback to environment variables
    env_val = os.getenv(name.upper())
    if env_val is not None:
        return env_val.lower() == "true"
    
    return DEFAULT_FLAGS.get(name, False)

async def set_flag(name: str, value: bool) -> None:
    """Configure dynamic feature flag value in Redis."""
    r = await get_redis()
    await r.set(f"flag:{name}", str(value).lower())
