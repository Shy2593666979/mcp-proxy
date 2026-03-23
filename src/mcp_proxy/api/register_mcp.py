from fastapi import APIRouter
from mcp_proxy.api.schemas import RegisterMcpRequest
from mcp_proxy.service.register_mcp import RegisterMcpService

router = APIRouter(prefix="/mcp", tags=["Register-Mcp"])

@router.post("/register", summary="根据传来的OpenAPI格式数据生成")
async def register_mcp_server(
    req: RegisterMcpRequest
):
    return await RegisterMcpService.register_mcp(req)
