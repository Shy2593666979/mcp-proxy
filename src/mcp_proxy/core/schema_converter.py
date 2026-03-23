"""
将 Tool 的 parameters JSON 转换为 MCP JsonSchema 格式
"""

import json
from typing import Any


def parse_input_schema(parameters: str | None) -> dict:
    """将 Tool.parameters JSON 字符串解析为 MCP inputSchema dict"""
    if not parameters:
        return {"type": "object", "properties": {}}

    try:
        schema = json.loads(parameters)
    except (json.JSONDecodeError, TypeError):
        return {"type": "object", "properties": {}}

    properties = schema.get("properties")
    if properties is not None:
        # 已经是 MCP JSON Schema 格式
        return {
            "type": schema.get("type", "object"),
            "properties": properties,
            "required": schema.get("required"),
            "additionalProperties": schema.get("additionalProperties"),
        }

    # OpenAPI 参数格式转换
    return _parse_openapi_schema(schema)


def _parse_openapi_schema(schema: dict) -> dict:
    properties: dict[str, Any] = {}
    required: list[str] = []
    param_required_map: dict[str, list[str]] = {}

    for param in schema.get("parameters", []):
        in_ = param.get("in", "query")
        name = param.get("name", "")
        is_required = param.get("required", False)
        description = param.get("description", name)
        param_schema = param.get("schema", {})
        param_type = param_schema.get("type", "string")
        default_val = param_schema.get("default")

        if is_required:
            param_required_map.setdefault(in_, []).append(name)

        if in_ not in properties:
            properties[in_] = {"type": "object", "properties": {}}

        prop_def: dict = {"type": param_type, "description": description}
        if default_val is not None:
            prop_def["default"] = default_val
        properties[in_]["properties"][name] = prop_def

    for in_, req_list in param_required_map.items():
        properties[in_]["required"] = req_list
        required.append(in_)

    request_body = schema.get("requestBody")
    if request_body:
        content = request_body.get("content", {})
        rb_map: dict = {}
        for content_type_full, content_def in content.items():
            content_type = content_type_full.split(";")[0].strip()
            rb_schema = content_def.get("schema", {})
            rb_type = rb_schema.get("type", "object")

            if content_type in ("application/json", "application/x-www-form-urlencoded"):
                rb_map["type"] = rb_type
                rb_required = rb_schema.get("required")
                if rb_required:
                    rb_map["required"] = rb_required
                    required.append("requestBody")
                if rb_type == "object":
                    rb_props = {}
                    for pname, pdef in rb_schema.get("properties", {}).items():
                        entry = {
                            "type": pdef.get("type", "string"),
                            "description": pdef.get("description", pname),
                        }
                        if pdef.get("type") == "array":
                            entry["items"] = pdef.get("items")
                        rb_props[pname] = entry
                    rb_map["properties"] = rb_props
                elif rb_type == "array":
                    rb_map["items"] = rb_schema.get("items")
            elif content_type == "application/octet-stream":
                rb_map["type"] = "string"

        if rb_map:
            properties["requestBody"] = rb_map

    return {
        "type": "object",
        "properties": properties,
        "required": required if required else [],
        "additionalProperties": False,
    }


def tool_to_mcp_schema(tool) -> dict:
    """将 Tool ORM 对象转换为 MCP tool schema dict"""
    return {
        "name": tool.name,
        "description": tool.description or "",
        "inputSchema": parse_input_schema(tool.parameters),
    }


def build_error_result(message: str) -> dict:
    return {
        "content": [{"type": "text", "text": f"Error: {message}"}],
        "isError": True,
    }
