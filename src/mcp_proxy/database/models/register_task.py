from typing import Optional, List, Any
from sqlmodel import SQLModel, Field, Column, Text, Relationship, DateTime, JSON
from datetime import datetime

from mcp_proxy.util import generate_uuid, get_now_time

REGISTER_MCP_TASK_NAME = "注册MCP任务"

class RegisterMcpTask(SQLModel, table=True):
    __tablename__ = "register_mcp_task"

    """
    messages 格式:
        [
            {
                "query": "你好",
                "answer": "你好，请问有什么可以帮助的吗？",
                "events": []
            }
        ]
    """
    id: str = Field(default_factory=generate_uuid, primary_key=True, max_length=64)
    name: str = Field(default=REGISTER_MCP_TASK_NAME)
    user_id: Optional[str] = Field(default=None)
    register_mcp_id: Optional[str] = Field(default=None)
    messages: Optional[List[Any]] = Field(default=[], sa_column=Column(JSON))
    created_time: datetime = Field(
        default_factory=get_now_time,
        sa_column=Column(DateTime, nullable=False, default=get_now_time)
    )
    updated_time: datetime = Field(
        default_factory=get_now_time,
        sa_column=Column(DateTime, nullable=False, default=get_now_time, onupdate=get_now_time)
    )