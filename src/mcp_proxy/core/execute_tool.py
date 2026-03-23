import base64
import json
import httpx
from typing import Any
from urllib.parse import urlencode

from mcp_proxy.database.models.mcp_tool import RegisterMcpTool
from loguru import logger

class RegisterMcpToolExecute:

    @classmethod
    async def execute_http_tool(cls, tool: RegisterMcpTool, arguments: dict) -> dict:
        """根据 Tool 的 api_info 执行 HTTP 请求，返回 MCP CallToolResult 格式"""
        api_info = tool.api_info or {}
        base_url = api_info.get("url", "")
        path = api_info.get("path", "")
        method = api_info.get("method", "GET").upper()
        content_type = api_info.get("content_type", "application/json")

        full_url = base_url + path
        path_vars: dict[str, str] = {}
        query_params: dict[str, str] = {}
        headers: dict[str, str] = {}
        cookies: dict[str, str] = {}
        body_bytes: bytes | None = None

        for param_type, param_val in arguments.items():
            if not isinstance(param_val, dict):
                continue
            if param_type == "path":
                path_vars.update({k: str(v) for k, v in param_val.items()})
            elif param_type == "query":
                query_params.update({k: str(v) for k, v in param_val.items()})
            elif param_type == "header":
                headers.update({k: str(v) for k, v in param_val.items()})
            elif param_type == "cookie":
                cookies.update({k: str(v) for k, v in param_val.items()})
            elif param_type == "requestBody":
                body_bytes = cls._encode_body(param_val, content_type)

        for var_name, var_val in path_vars.items():
            full_url = full_url.replace(f"{{{var_name}}}", var_val)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.request(
                    method=method,
                    url=full_url,
                    params=query_params or None,
                    headers={**headers, "Content-Type": content_type} if body_bytes else headers,
                    cookies=cookies or None,
                    content=body_bytes,
                )
            result: dict[str, Any] = {
                "isError": not resp.is_success,
                "content": [{"type": "text", "text": resp.text}],
            }

            if resp.is_success and "application/json" in resp.headers.get("content-type", ""):
                try:
                    result["structuredContent"] = resp.json()
                except Exception:
                    pass
            return result
        except Exception as e:
            logger.error(f"HTTP request failed for tool {tool.name}: {e}")
            return {"isError": True, "content": [{"type": "text", "text": str(e)}]}

    @classmethod
    def _encode_body(cls, body: Any, content_type: str) -> bytes | None:
        ct = content_type.split(";")[0].strip()
        if ct == "application/json":
            return json.dumps(body).encode()
        elif ct == "application/x-www-form-urlencoded":
            if isinstance(body, dict):
                return urlencode(body).encode()
        elif ct == "application/octet-stream":
            if isinstance(body, str):
                return base64.b64decode(body)
        return None