"""
MCP SSE / JSON-RPC 端点
Controller 层：只做参数解析、鉴权、响应组装，业务逻辑委托给 McpService
"""
import asyncio
import json
import time
from typing import Any, AsyncGenerator

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import JSONResponse
from sse_starlette import EventSourceResponse

from mcp_proxy.api.schemas import (
    HealthResponse, JsonRpcError, JsonRpcResponse,
    RegisterMcpRequest, RegisterMcpResponse,
)
from mcp_proxy.config import settings
from mcp_proxy.service.register_mcp import RegisterMcpService
from mcp_proxy.service.session.manager import SessionManager
from mcp_proxy.service.session.models import ClientInfo, ClientCapabilities
from loguru import logger

router = APIRouter(prefix="/mcp")

_active_sessions: dict[str, asyncio.Queue] = {}

def get_session_manager(request: Request) -> SessionManager:
    return request.app.state.session_manager


def _check_auth(request: Request) -> bool:
    if not settings.auth_enabled:
        return True
    token = settings.auth_token
    if not token:
        return False
    if request.query_params.get("token") == token:
        return True
    bearer = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    return bearer == token


# SSE 连接
@router.get("/{server_key}/sse")
async def sse_endpoint(
    server_key: str,
    request: Request,
    sm: SessionManager = Depends(get_session_manager),
):
    if not _check_auth(request):
        return Response(content="Authentication failed", status_code=401)

    session = await sm.create_session(
        server_name=server_key,
        environment="prod",
        client_info=ClientInfo(),
        capabilities=ClientCapabilities(),
    )
    session_id = session.session_id
    queue: asyncio.Queue = asyncio.Queue()
    _active_sessions[session_id] = queue
    await queue.put({"event": "endpoint", "data": f"/mcp/{server_key}/message?sessionId={session_id}"})

    async def event_generator() -> AsyncGenerator[dict, None]:
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield item
                except asyncio.TimeoutError:
                    yield {"event": "ping", "data": json.dumps({"timestamp": int(time.time() * 1000)})}
        finally:
            _active_sessions.pop(session_id, None)
            await sm.delete_session(session_id)
            logger.info(f"SSE session cleaned up: {session_id}")

    return EventSourceResponse(event_generator())


# JSON-RPC 消息
@router.post("/{server_key}/message", response_model=JsonRpcResponse)
async def message_endpoint(
    server_key: str,
    request: Request,
    session_id: str = Query(..., alias="sessionId"),
    sm: SessionManager = Depends(get_session_manager),
):
    if not _check_auth(request):
        return JSONResponse(_rpc_error(None, -32001, "Authentication failed").model_dump(), status_code=401)

    session = await sm.get_session(session_id)
    if not session:
        return JSONResponse(_rpc_error(None, -32000, "Session not found").model_dump(), status_code=400)
    if session.server_name != server_key:
        return JSONResponse(_rpc_error(None, -32000, "Session mismatch").model_dump(), status_code=400)

    await sm.touch_session(session_id)

    try:
        payload = json.loads(await request.body())
    except json.JSONDecodeError as e:
        return JSONResponse(_rpc_error(None, -32700, "Parse error", str(e)).model_dump())

    response = await _process_jsonrpc(server_key, session_id, payload)
    if response is None:
        return Response(status_code=204)

    queue = _active_sessions.get(session_id)
    if queue:
        await queue.put({"event": "message", "data": json.dumps(response.model_dump(exclude_none=True))})

    return JSONResponse(response.model_dump(exclude_none=True))


async def _process_jsonrpc(
    server_key: str, session_id: str, payload: dict
) -> JsonRpcResponse | None:
    method = payload.get("method", "")
    params = payload.get("params", {})
    rpc_id = payload.get("id")
    logger.info(f"JSON-RPC method={method} server={server_key} session={session_id}")

    if method == "initialize":
        return _handle_initialize(rpc_id, params)
    elif method == "tools/list":
        return await _handle_tools_list(server_key, rpc_id)
    elif method == "tools/call":
        return await _handle_tools_call(server_key, rpc_id, params)
    elif method == "ping":
        return _rpc_ok(rpc_id, {})
    elif method == "notifications/initialized":
        logger.info(f"Client initialized: session={session_id}")
        return None
    else:
        return _rpc_error(rpc_id, -32601, "Method not found", method)


def _handle_initialize(rpc_id: Any, params: dict) -> JsonRpcResponse:
    client_name = params.get("clientInfo", {}).get("name", "unknown")
    client_version = params.get("clientInfo", {}).get("version", "unknown")
    logger.info(f"Client initializing: {client_name} v{client_version}")
    return _rpc_ok(rpc_id, {
        "protocolVersion": "2024-11-05",
        "serverInfo": {"name": settings.server_name, "version": "1.0.0"},
        "capabilities": {"tools": {"listChanged": True}},
    })


async def _handle_tools_list(server_key: str, rpc_id: Any) -> JsonRpcResponse:
    try:
        tools = await RegisterMcpService.get_tools_for_server(server_key)
        return _rpc_ok(rpc_id, {"tools": tools})
    except Exception as e:
        logger.error(f"tools/list failed: {e}")
        return _rpc_error(rpc_id, -32603, "Internal error", str(e))


async def _handle_tools_call(server_key: str, rpc_id: Any, params: dict) -> JsonRpcResponse:
    tool_name = params.get("name")
    if not tool_name:
        return _rpc_error(rpc_id, -32602, "Invalid params", "name is required")
    result = await RegisterMcpService.call_tool(server_key, tool_name, params.get("arguments", {}))
    return _rpc_ok(rpc_id, result)



@router.get("/{server_key}/health", response_model=HealthResponse)
async def health_check(server_key: str):
    return HealthResponse(
        status="UP",
        server_name=settings.server_name,
        active_sessions=len(_active_sessions),
        timestamp=int(time.time()),
    )

def _rpc_ok(rpc_id: Any, result: Any) -> JsonRpcResponse:
    return JsonRpcResponse(id=rpc_id, result=result)


def _rpc_error(rpc_id: Any, code: int, message: str, data: str | None = None) -> JsonRpcResponse:
    return JsonRpcResponse(id=rpc_id, error=JsonRpcError(code=code, message=message, data=data))
