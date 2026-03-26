from loguru import logger
from fastapi import APIRouter
from pydantic import ValidationError

from mcp_proxy.database.dao.register_mcp import RegisterMcpDao
from mcp_proxy.schemas.register_mcp import RegisterMcpRequest
from mcp_proxy.schemas.openapi import OpenApiSchema
from mcp_proxy.schemas.response import resp_200
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
    result = await RegisterMcpService.register_mcp(req)
    return resp_200(data=result)

@router.get("/list", summary="获取注册的MCP列表")
async def get_all_register_mcps():
    results = await RegisterMcpDao.get_all()

    results = sorted([
        {
            **mcp.model_dump(),
            "mcp_tools": [tool.model_dump() for tool in mcp.mcp_tools]
        }
        for mcp in results
    ], key=lambda x: x["updated_time"], reverse=True)

    return resp_200(data=results)
