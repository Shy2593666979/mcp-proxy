import json
from loguru import logger
from typing import Callable
from pydantic import BaseModel
from fastapi import APIRouter
from starlette.types import Receive
from starlette.responses import StreamingResponse
from langchain_core.messages import HumanMessage

from mcp_proxy.core.agent import AbstractMcpAgent
from mcp_proxy.database.dao.register_task import RegisterMcpTaskDao

router = APIRouter(tags=["Completion"])

class CompletionReq(BaseModel):
    query: str
    task_id: str

class WatchedStreamingResponse(StreamingResponse):
    """
    重写 StreamingResponse类 保证流式输出的时候可随时暂停
    """
    def __init__(
        self,
        content,
        callback: Callable = None,
        status_code: int = 200,
        headers = None,
        media_type: str | None = None,
        background = None,
    ):
        super().__init__(content, status_code, headers, media_type, background)

        self.callback = callback

    async def listen_for_disconnect(self, receive: Receive) -> None:
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                logger.info("http.disconnect. stop task and streaming")

                if self.callback:
                    self.callback()

                break

@router.post("/completion")
async def completion(
    req: CompletionReq
):
    # 保证当前的任务存在
    await RegisterMcpTaskDao.create_task_if_not_exists(req.task_id)
    current_task = await RegisterMcpTaskDao.get_task(req.task_id)

    if current_task.messages:
        # 构建历史消息上下文
        history_context = "\n可供参考的历史消息： " + "\n".join([
            f"query: {msg['query']} \n answer: {_extract_text_from_content(msg.get('content', []))}" 
            for msg in current_task.messages
        ])
        processed_query = req.query + history_context
    else:
        processed_query = req.query
    
    # 内容数组：按顺序存储事件和文本
    content_array = []

    async def general_generate():
        """
        流式响应生成器

        实时处理AI助手的响应流，将内容按SSE格式返回给前端，
        同时收集和处理各种事件（工具调用、状态变更等）
        """
        try:
            async for event in AbstractMcpAgent().astream([HumanMessage(processed_query)]):

                if event.get("type") == "text":
                    # 文本内容
                    content_array.append({
                        "type": "text",
                        "data": event.get("content", "")
                    })
                    yield f'data: {json.dumps(event, ensure_ascii=False)}\n\n'
                else:
                    print(event)
                    # 事件内容
                    content_array.append({
                        "type": "event",
                        "data": event.get("event", {})
                    })
                    yield f'data: {json.dumps(event, ensure_ascii=False)}\n\n'
        finally:
            # 保存到MySQL数据库
            await RegisterMcpTaskDao.add_task_message(
                task_id=req.task_id,
                message={"query": req.query, "content": content_array}
            )

    return WatchedStreamingResponse(
        content=general_generate(),
        media_type="text/event-stream"
    )


def _extract_text_from_content(content_array):
    """从 content 数组中提取所有文本内容"""
    if not content_array:
        return ""
    return "".join([
        item.get("data", "") 
        for item in content_array 
        if item.get("type") == "text"
    ])




