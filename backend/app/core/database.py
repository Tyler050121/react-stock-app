"""
数据库连接模块
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from .config import config

# 获取数据库URL,如果配置中没有则使用默认值
SQLALCHEMY_DATABASE_URL = config.database_url or "sqlite+aiosqlite:///./stocks.db"

engine = create_async_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False}
)

AsyncSessionLocal = sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

async def get_db():
    """获取数据库会话"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def init_db():
    """初始化数据库"""
    from ..models import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
