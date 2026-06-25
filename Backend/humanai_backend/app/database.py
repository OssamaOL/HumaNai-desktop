from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

is_sqlite = settings.DATABASE_URL.startswith("sqlite")
engine_kwargs = {
    "echo": settings.APP_ENV == "development",
}
connect_args = {}

if not is_sqlite:
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20
    engine_kwargs["pool_pre_ping"] = True
else:
    from sqlalchemy.pool import StaticPool
    engine_kwargs["poolclass"] = StaticPool
    connect_args["check_same_thread"] = False

engine = create_async_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    **engine_kwargs
)


AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

class Base(DeclarativeBase):
    pass

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

async def set_rls_context(session: AsyncSession, user_id: str, role: str, dept_id: str = "", tenant_id: str = "default-tenant"):
    """Inject RLS context into PostgreSQL session safely."""
    from sqlalchemy import text
    import uuid
    
    # Ensure user_id is a valid UUID string to prevent cast failures in Postgres RLS
    valid_user_id = ""
    if user_id:
        try:
            uuid.UUID(str(user_id))
            valid_user_id = str(user_id)
        except ValueError:
            pass

    try:
        # Use set_config to set session-local variables safely with parameters
        await session.execute(
            text("SELECT set_config('app.current_user_id', :user_id, true);"),
            {"user_id": valid_user_id}
        )
        await session.execute(
            text("SELECT set_config('app.current_user_role', :role, true);"),
            {"role": str(role)}
        )
        await session.execute(
            text("SELECT set_config('app.current_dept_id', :dept_id, true);"),
            {"dept_id": str(dept_id)}
        )
        await session.execute(
            text("SELECT set_config('app.tenant_id', :tenant_id, true);"),
            {"tenant_id": str(tenant_id)}
        )
    except Exception:
        pass


