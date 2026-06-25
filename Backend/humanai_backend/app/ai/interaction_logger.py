import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import insert, select, func
from app.models.alert import AiInteraction
from app.models.user import User
from app.config import settings

async def log_interaction(
    db: AsyncSession,
    user: any,
    agent_name: str,
    summary: str,
    scopes: list[str],
    session_id: any = None,
    query_text: str = None
) -> uuid.UUID:
    """
    Logs an AI interaction to the database.
    - Encrypts `query_text` using pgp_sym_encrypt if PostgreSQL is used.
    - Resolves user's Firebase UID to database UUID if necessary.
    """
    db_user_id = None
    role = "collaborateur"
    
    # 1. Resolve user role
    if hasattr(user, "role"):
        role = user.role
    elif isinstance(user, dict) and "role" in user:
        role = user["role"]
        
    # 2. Resolve database user_id
    uid_val = None
    if hasattr(user, "uid"):
        uid_val = user.uid
    elif hasattr(user, "id"):
        db_user_id = user.id
    elif isinstance(user, dict):
        uid_val = user.get("uid") or user.get("user_id") or user.get("id")
    elif isinstance(user, str):
        uid_val = user
        
    if not db_user_id and uid_val:
        # Check if uid_val is already a valid UUID
        try:
            db_user_id = uuid.UUID(str(uid_val))
        except ValueError:
            # Resolve Firebase UID to database user UUID
            result = await db.execute(select(User.id).where(User.firebase_uid == str(uid_val)))
            db_user_id = result.scalar_one_or_none()

    if not db_user_id:
        # Fallback to a dummy uuid to satisfy database foreign keys if user is not found
        db_user_id = uuid.uuid4()
        
    # 3. Resolve session_id
    final_session_id = session_id
    if not final_session_id:
        final_session_id = uuid.uuid4()
    elif isinstance(final_session_id, str):
        try:
            final_session_id = uuid.UUID(final_session_id)
        except ValueError:
            final_session_id = uuid.uuid4()

    # 4. Handle encryption based on database engine
    is_sqlite = settings.DATABASE_URL.startswith("sqlite")
    query_val = query_text or f"Génération documentaire par l'agent {agent_name}"
    
    if is_sqlite:
        query_expr = query_val
    else:
        # Use PostgreSQL pgp_sym_encrypt function
        query_expr = func.pgp_sym_encrypt(query_val, settings.APP_ENCRYPTION_KEY)

    # 5. Insert interaction
    interaction_id = uuid.uuid4()
    await db.execute(
        insert(AiInteraction).values(
            id=interaction_id,
            user_id=db_user_id,
            session_id=final_session_id,
            query_text=query_expr,
            response_summary=summary,
            role_at_time=role,
            data_scope_requested=scopes,
            is_security_event=False
        )
    )
    
    return interaction_id
