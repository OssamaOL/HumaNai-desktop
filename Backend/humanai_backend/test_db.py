import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.config import settings

async def main():
    print(f"Testing DB connection to: {settings.DATABASE_URL}")
    try:
        engine = create_async_engine(settings.DATABASE_URL)
        async with engine.connect() as conn:
            result = await conn.execute("SELECT 1")
            print("Database connection SUCCESSFUL! Result:", result.scalar())
    except Exception as e:
        import traceback
        print("\n--- DATABASE ERROR ---")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
