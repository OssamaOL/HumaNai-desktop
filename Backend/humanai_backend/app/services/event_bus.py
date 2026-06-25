import json
import uuid
import time
from app.redis_client import get_redis

async def publish_event(
    event_name: str,
    tenant_id: str,
    payload: dict,
    correlation_id: uuid.UUID
) -> None:
    """
    Publish an event to the Redis Stream 'huma-events' for telemetry, audits, and real-time monitoring.
    """
    try:
        r = await get_redis()
        event_id = str(uuid.uuid4())
        event_data = {
            "event_id": event_id,
            "event_name": event_name,
            "tenant_id": tenant_id,
            "correlation_id": str(correlation_id),
            "timestamp": str(time.time()),
            "payload": json.dumps(payload, default=str)
        }
        # Add entry to Redis Stream 'huma-events'
        await r.xadd("huma-events", event_data)
    except Exception as e:
        # Prevent telemetry failures from blocking database operations
        import logging
        logger = logging.getLogger("event_bus")
        logger.error(f"Failed to publish event {event_name}: {e}")
