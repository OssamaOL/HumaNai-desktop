import asyncio
from sqlalchemy.ext.asyncio import create_async_engine

urls = [
    "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres",
    "postgresql+asyncpg://postgres:postgres@localhost:5433/postgres",
    "postgresql+asyncpg://postgres:CHANGE_ME@localhost:5432/postgres",
    "postgresql+asyncpg://postgres:CHANGE_ME@localhost:5433/postgres",
    "postgresql+asyncpg://humanai_user:CHANGE_ME@localhost:5432/humanai_db",
    "postgresql+asyncpg://humanai_user:CHANGE_ME@localhost:5433/humanai_db",
]

async def check_conn(url):
    try:
        engine = create_async_engine(url, connect_args={"timeout": 3})
        async with engine.connect() as conn:
            await conn.execute("SELECT 1")
            print(f"[SUCCESS] {url}")
            return True
    except Exception as e:
        print(f"[FAILED] {url} -> {type(e).__name__}: {str(e)[:100]}")
        return False

async def main():
    for url in urls:
        await check_conn(url)

if __name__ == "__main__":
    asyncio.run(main())
