from loguru import logger
from typing import Iterator, AsyncIterator
from urllib.parse import urlparse, urlunparse
from contextlib import contextmanager, asynccontextmanager

from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import SQLModel, Session, create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine

from mcp_proxy.config import settings

engine = create_engine(
    url=settings.db_url,
    pool_pre_ping=True, # 连接前检查其有效性
    pool_recycle=3600, # 每隔1小时进行重连一次
    connect_args={
        "charset": "utf8mb4",
        "use_unicode": True,
        "init_command": "SET SESSION time_zone = '+08:00'"
    }
)

async_engine = create_async_engine(
    url=settings.db_url,
    pool_pre_ping=True,  # 连接前检查其有效性
    pool_recycle=3600,  # 每隔1小时进行重连一次
    connect_args={
        "charset": "utf8mb4",
        "use_unicode": True,
        "init_command": "SET SESSION time_zone = '+08:00'"
    }
)


@contextmanager
def session_getter() -> Iterator[Session]:
    session = Session(engine)

    try:
        yield session
    except Exception as e:
        logger.info('Session rollback because of exception:{}', e)
        session.rollback()
        raise
    finally:
        session.close()

@asynccontextmanager
async def async_session_getter() -> AsyncIterator[AsyncSession]:
    session = AsyncSession(async_engine)  # 使用异步引擎创建会话

    try:
        yield session
    except Exception as e:
        logger.info('Session rollback because of exception: %s', e)
        await session.rollback()  # 异步回滚
        raise
    finally:
        await session.close()  # 异步关闭会话

def ensure_mysql_database(endpoint: str = None) -> None:
    """
    确保 MySQL 数据库存在，每次启动时安全调用。
    """
    if not endpoint:
        endpoint = settings.db_url

    # 将 async driver 替换为同步 pymysql 用于 bootstrap
    sync_url = endpoint.replace("mysql+aiomysql://", "mysql+pymysql://")
    parsed = urlparse(sync_url)

    database = parsed.path.lstrip("/")
    if not database:
        raise ValueError("MySQL endpoint must include database name")

    bootstrap_url = urlunparse((
        "mysql+pymysql",
        f"{parsed.username}:{parsed.password}@{parsed.hostname}:{parsed.port or 3306}",
        "/",
        "",
        "",
        ""
    ))

    logger.info(f"Checking MySQL database `{database}`")

    bootstrap_engine = create_engine(
        bootstrap_url,
        isolation_level="AUTOCOMMIT",
        connect_args={
            "charset": "utf8mb4",
            "init_command": "SET SESSION time_zone = '+08:00'"
        }
    )

    try:
        with bootstrap_engine.connect() as conn:
            conn.execute(
                text(
                    f"""
                    CREATE DATABASE IF NOT EXISTS `{database}`
                    DEFAULT CHARACTER SET utf8mb4
                    COLLATE utf8mb4_unicode_ci
                    """
                )
            )
        logger.success(f"MySQL database `{database}` is ready")
    finally:
        bootstrap_engine.dispose()


async def init_db():
    ensure_mysql_database()
    async with async_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)