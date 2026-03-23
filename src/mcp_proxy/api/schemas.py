from typing import Optional, Any, Literal
from pydantic import BaseModel, Field


class RegisterMcpRequest(BaseModel):
    """
    通过 OpenAPI 3.1+ schema 注册 MCP 服务。

    - `mcp_id`         可选，不传则自动生成 UUID
    - `name`           可选，合法标识符（字母/数字/下划线），不传则从 openapi_schema.info.title 推断
    - `description`    可选，服务描述，不传则从 openapi_schema.info.description 推断
    - `openapi_schema` 必传，标准 OpenAPI 3.1+ 文档对象
    """
    mcp_id: Optional[str] = None
    name: Optional[str] = Field(default=None, pattern=r"^[A-Za-z_][A-Za-z0-9_]*$")
    transport: Literal["sse", "streamable_http"] = "sse"
    description: Optional[str] = None
    openapi_schema: dict[str, Any]


class RegisterMcpResponse(BaseModel):
    mcp_id: str
    name: str
    tool_count: int


class HealthResponse(BaseModel):
    status: str
    server_name: str
    active_sessions: int
    timestamp: int


class JsonRpcError(BaseModel):
    code: int
    message: str
    data: Optional[str] = None


class JsonRpcResponse(BaseModel):
    jsonrpc: str = "2.0"
    id: Optional[Any] = None
    result: Optional[Any] = None
    error: Optional[JsonRpcError] = None