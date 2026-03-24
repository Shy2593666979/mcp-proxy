from loguru import logger
from fastapi import APIRouter
from pydantic import ValidationError
from mcp_proxy.schemas.register_mcp import RegisterMcpRequest
from mcp_proxy.schemas.openapi import OpenApiSchema
from mcp_proxy.service.register_mcp import RegisterMcpService

router = APIRouter(prefix="/mcp", tags=["Register-Mcp"])

@router.post("/register", summary="根据传来的OpenAPI格式数据生成")
async def register_mcp_server(
    req: RegisterMcpRequest
):
    try:
        OpenApiSchema.model_validate(req.openapi_schema)
    except ValidationError as err:
        logger.error(f"传入不合法的OpenAPI Schema: {err}")
        raise err
    return await RegisterMcpService.register_mcp(req)

