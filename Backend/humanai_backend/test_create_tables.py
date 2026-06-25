import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.models import Base

async def main():
    db_url = "sqlite+aiosqlite:///test_humanai.db"
    print(f"Testing table creation on SQLite: {db_url}")
    try:
        engine = create_async_engine(db_url)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("Table creation SUCCESSFUL!")
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
