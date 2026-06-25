from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import insert, select
from app.models.audit import AuditLog
from app.models.user import User
import uuid

async def log_action(
    db: AsyncSession,
    user_id: str,
    action: str,
    entity_type: str = None,
    entity_id: str = None,
    details: dict = None,
    ip_address: str = None,
    correlation_id: uuid.UUID = None,
    tenant_id: str = None
):
    db_user_id = None
    resolved_tenant = tenant_id

    if user_id:
        try:
            # Check if it's a valid UUID string
            db_user_id = uuid.UUID(str(user_id))
            # Resolve tenant from user ID if not provided
            if not resolved_tenant:
                res = await db.execute(select(User.tenant_id).where(User.id == db_user_id))
                resolved_tenant = res.scalar_one_or_none()
        except ValueError:
            # Resolve Firebase UID to DB User ID & Tenant ID
            result = await db.execute(select(User.id, User.tenant_id).where(User.firebase_uid == user_id))
            row = result.first()
            if row:
                db_user_id = row[0]
                if not resolved_tenant:
                    resolved_tenant = row[1]

    if not resolved_tenant:
        resolved_tenant = "default-tenant"

    db_entity_id = None
    if entity_id:
        try:
            db_entity_id = uuid.UUID(str(entity_id))
        except ValueError:
            pass

    await db.execute(insert(AuditLog).values(
        id=uuid.uuid4(),
        tenant_id=resolved_tenant,
        user_id=db_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=db_entity_id,
        details=details or {},
        ip_address=ip_address,
        correlation_id=correlation_id
    ))

