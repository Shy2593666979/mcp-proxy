"""
MCP Proxy Python - FastAPI + MySQL 版本
"""
from contextlib import asynccontextmanager
from pathlib import Path

import redis.asyncio as aioredis
from loguru import logger
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from mcp_proxy.api.register_mcp import router as register_mcp
from mcp_proxy.api.mcp_sse import router as mcp_router
from mcp_proxy.api.completion import router as completion_router
from mcp_proxy.api.register_task import router as register_task_router
from mcp_proxy.api.mcp_streamable_http import router as mcp_streamable_http_router
from mcp_proxy.config import settings
from mcp_proxy.database.session import init_db
from mcp_proxy.service.session.manager import SessionManager

# 获取项目根目录
BASE_DIR = Path(__file__).resolve().parent.parent.parent
STATIC_DIR = BASE_DIR / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
    app.state.session_manager = SessionManager(redis_client)

    logger.info("MCP Proxy started. DB and Redis initialized.")

    yield

    logger.info("MCP Proxy shutting down...")


app = FastAPI(title="MCP Proxy", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(mcp_router)
app.include_router(register_mcp)
app.include_router(mcp_streamable_http_router)
app.include_router(completion_router)
app.include_router(register_task_router)

@app.get("/health")
async def health():
    return {"status": "UP", "service": "mcp-proxy"}

# 挂载静态文件（必须放在最后，避免覆盖 API 路由）
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=7080)
