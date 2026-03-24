from loguru import logger
from fastapi import APIRouter

from mcp_proxy.config import settings
from mcp_proxy.core.chat import AbstractMcpAgent
from mcp_proxy.schemas.register_mcp import RegisterMcpServer

router = APIRouter(tags=["Completion"])

from pydantic import BaseModel, ValidationError

class CompletionReq(BaseModel):
    session_id: str
    query: str


@router.post("/completion")
async def completion(
    req: CompletionReq
):
    abstract_agent = AbstractMcpAgent(
        api_key=settings.model_api_key,
        base_url=settings.model_base_url,
    )

    response = abstract_agent.abstract_mcp_json(req.query)
    try:
        register_mcp_server = RegisterMcpServer.model_validate(response)
    except ValidationError as err:
        logger.error(f"校验生成的格式失败: {err}")
        raise err


