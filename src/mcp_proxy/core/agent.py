"""
使用 LangChain 1.0+ create_agent 编排工作流
完成 MCP Json 生成、校验、修复、注册
LLM 自主决定调用哪些工具及顺序
"""
import json
from langchain.agents import create_agent
from langchain.tools import tool, ToolRuntime
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessageChunk
from langgraph.config import get_stream_writer
from pydantic import ValidationError

from mcp_proxy.config import settings
from mcp_proxy.core.prompts import (
    GENERATE_MCP_JSON_PROMPT,
    RESTORE_MCP_JSON_PROMPT,
    GENERATE_USER_REPLY_PROMPT,
)
from mcp_proxy.schemas.register_mcp import RegisterMcpServerModel
from mcp_proxy.service.register_mcp import RegisterMcpService


# ── 工具定义 ───────────────────────────────────────────────────────────────────

@tool
def generate_mcp_json(user_query: str, runtime: ToolRuntime) -> str:
    """根据用户描述，提取并生成标准的 MCP Server JSON 配置字符串。
    当用户想要注册一个 MCP Server 时，首先调用此工具生成 JSON。

    Args:
        user_query: 用户原始输入，描述想要注册的 MCP Server 信息
    """
    writer = get_stream_writer()

    writer({
        "title": "提取Query中的Mcp必要信息",
        "status": "START",
        "is_error": False,
        "content": ""
    })

    # 直接返回带前缀的 prompt，让调用方（agent）知道要生成什么
    # 注意：工具本身调用独立的 LLM 来完成生成

    client = ChatOpenAI(
        model=settings.model_name,
        api_key=settings.model_api_key,
        base_url=settings.model_base_url,
    )

    response = client.invoke(
        input=[HumanMessage(content=GENERATE_MCP_JSON_PROMPT + user_query)],
        config={"callbacks": []}
    )

    mcp_json_str = response.content

    writer({
        "title": "提取Query中的Mcp必要信息",
        "status": "END",
        "is_error": False,
        "content": mcp_json_str
    })

    return mcp_json_str


@tool
def verify_mcp_json(mcp_json_str: str, runtime: ToolRuntime) -> str:
    """校验 MCP JSON 字符串是否合法，包括 JSON 格式和 Pydantic Schema 校验。
    生成 JSON 后必须调用此工具进行校验，根据结果决定下一步。

    Args:
        mcp_json_str: 待校验的 MCP JSON 字符串
    """
    writer = get_stream_writer()

    writer({
        "title": "校验Mcp Json是否合规",
        "status": "START",
        "is_error": False,
        "content": ""
    })

    # JSON 格式校验
    try:
        if isinstance(mcp_json_str, str):
            data = json.loads(mcp_json_str)
        else:
            data = mcp_json_str
    except Exception as e:
        err = f"JSON解析失败: {e}"
        writer({
            "title": "校验Mcp Json是否合规",
            "status": "END",
            "is_error": True,
            "content": err
        })
        return f"VERIFY_FAILED: {err}"

    # Pydantic schema 校验
    try:
        RegisterMcpServerModel.model_validate(data)
    except ValidationError as e:
        err = f"Pydantic校验失败: {e}"
        writer({
            "title": "校验Mcp Json是否合规",
            "status": "END",
            "is_error": True,
            "content": err
        })
        return f"VERIFY_FAILED: {err}"

    writer({
        "title": "校验Mcp Json是否合规",
        "status": "END",
        "is_error": False,
        "content": "校验成功"
    })

    return f"VERIFY_SUCCESS: {json.dumps(data, ensure_ascii=False)}"


@tool
def restore_mcp_json(mcp_json_str: str, error_message: str, runtime: ToolRuntime) -> str:
    """根据校验错误信息，修复不合法的 MCP JSON。
    当 verify_mcp_json 返回 VERIFY_FAILED 时调用此工具，修复后需再次校验。
    最多修复 2 次，超过后应放弃并告知用户。

    Args:
        mcp_json_str: 需要修复的 MCP JSON 字符串
        error_message: verify_mcp_json 返回的错误信息
    """
    writer = get_stream_writer()

    writer({
        "title": "修复Mcp Json",
        "status": "START",
        "is_error": False,
        "content": ""
    })


    client = ChatOpenAI(
        model=settings.model_name,
        api_key=settings.model_api_key,
        base_url=settings.model_base_url,
    )

    response = client.invoke([
            SystemMessage(content=RESTORE_MCP_JSON_PROMPT.format(mcp_json=mcp_json_str)),
            HumanMessage(content=error_message)
        ])

    fixed_json = response.content

    writer({
        "title": "修复Mcp Json",
        "status": "END",
        "is_error": False,
        "content": fixed_json
    })

    return fixed_json


@tool
async def register_mcp_server(mcp_json_str: str, runtime: ToolRuntime) -> str:
    """将已通过校验的 MCP JSON 注册为 MCP Server。
    只有在 verify_mcp_json 返回 VERIFY_SUCCESS 后才调用此工具。

    Args:
        mcp_json_str: 已通过校验的 MCP JSON 字符串（VERIFY_SUCCESS 后的数据部分）
    """
    writer = get_stream_writer()

    writer({
        "title": "开始创建Mcp Server",
        "status": "START",
        "is_error": False,
        "content": ""
    })


    async def _register():
        try:
            # 兼容传入 VERIFY_SUCCESS: {...} 格式
            json_str = mcp_json_str
            if json_str.startswith("VERIFY_SUCCESS:"):
                json_str = json_str[len("VERIFY_SUCCESS:"):].strip()

            data = json.loads(json_str) if isinstance(json_str, str) else json_str
            mcp_server = RegisterMcpServerModel.model_validate(data)
            result = await RegisterMcpService.register_mcp_by_completion(mcp_server)
            result_dict = result.model_dump() if hasattr(result, "model_dump") else result
            return True, result_dict
        except Exception as e:
            return False, str(e)

    ok, result = await _register()

    if not ok:
        writer({
            "title": "开始创建Mcp Server",
            "status": "END",
            "is_error": True,
            "content": result
        })
        return f"REGISTER_FAILED: {result}"

    writer({
        "title": "开始创建Mcp Server",
        "status": "END",
        "is_error": False,
        "content": "注册成功"
    })

    return f"REGISTER_SUCCESS: {json.dumps(result, ensure_ascii=False)}"


# ── Agent 定义 ─────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """你是一个专业的 MCP Server 注册助手，负责帮助用户将 MCP Server 配置注册到系统中。

你有以下工具可以使用：
1. generate_mcp_json   - 从用户描述中提取并生成 MCP JSON 配置
2. verify_mcp_json     - 校验 JSON 格式和 Schema 合法性
3. restore_mcp_json    - 修复不合法的 JSON（最多使用 2 次）
4. register_mcp_server - 注册已通过校验的 MCP Server

工作流程：
1. 调用 generate_mcp_json 生成配置
2. 调用 verify_mcp_json 校验
3. 若校验失败（VERIFY_FAILED），调用 restore_mcp_json 修复，再次校验，最多重复 2 次
4. 若超过 2 次仍失败，直接告知用户无法完成注册
5. 若校验成功（VERIFY_SUCCESS），调用 register_mcp_server 注册
6. 根据注册结果给出友好的中文回复

注意：每一步都要根据工具的返回结果决定下一步，不要跳过校验直接注册。
"""


class AbstractMcpAgent:
    def __init__(self):
        self.model = ChatOpenAI(
            model=settings.model_name,
            api_key=settings.model_api_key,
            base_url=settings.model_base_url,
        )

        self.tools = [
            generate_mcp_json,
            verify_mcp_json,
            restore_mcp_json,
            register_mcp_server,
        ]

        # LangChain 1.0+ create_agent
        self.agent = create_agent(
            model=self.model,
            tools=self.tools,
            system_prompt=SystemMessage(content=SYSTEM_PROMPT),
        )

    async def astream(self, messages):
        """流式执行 Agent，yield text 和 event 两种类型的数据"""
        async for part in self.agent.astream(
            input={"messages": messages},
            stream_mode=["messages", "custom"],
            version="v2",
        ):
            if part["type"] == "messages":
                msg, metadata = part["data"]
                if msg.content and isinstance(msg, AIMessageChunk):
                    yield {
                        "type": "text",
                        "content": msg.content,
                        "event": {}
                    }
            elif part["type"] == "custom":
                yield {
                    "type": "event",
                    "content": "",
                    "event": part["data"]
                }