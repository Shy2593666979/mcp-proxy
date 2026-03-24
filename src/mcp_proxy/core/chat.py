import re
import json
from openai import OpenAI

class AbstractMcpAgent:

    def __init__(self, base_url: str, api_key: str):
        self.client = OpenAI(
            base_url=base_url,
            api_key=api_key
        )


    def abstract_mcp_json(self, query):
        resp = self.client.chat.completions.create(
            model="gpt-5.3",
            messages=[
                {"role": "system", "content": "你是一个精确的JSON生成器"},
                {"role": "user", "content": MCP_CURL_TO_JSON_PROMPT.format(query=query)}
            ],
            temperature=0
        )

        content = resp.choices[0].message.content
        try:
            return json.loads(content)
        except Exception:
            match = re.search(r"\{.*\}", content, re.S)
            if match:
                return json.loads(match.group())
            raise ValueError("模型输出不是合法 JSON")



MCP_CURL_TO_JSON_PROMPT = """
你是一个 API 结构解析专家。

你的任务：把 curl 命令转换成 MCP Server 注册 JSON。

【严格要求】
- 必须输出合法 JSON
- 不要输出解释
- 不要输出 markdown
- 不要输出多余内容

【目标 JSON 结构】

{
  "name": "string",
  "transport": "sse",
  "description": "string",
  "tools": [
    {
      "name": "string",
      "description": "string",
      "parameters": {
        "type": "object",
        "properties": {
          "param_name": {
            "type": "string|number|boolean|array|object",
            "description": "string",
            "x-position": "query|path|header|cookie|body",
            "default": null
          }
        },
        "required": ["string"],
        "additionalProperties": false
      },
      "api_info": {
        "base_url": "string",
        "path": "string",
        "method": "string",
        "content_type": "string"
      }
    }
  ]
}

【解析规则】

1. URL：
   - base_url = scheme + host
   - path = 路径
2. query 参数 → x-position=query
3. header → x-position=header
4. JSON body → x-position=body
5. 自动推断字段类型：
   - string / number / boolean / array / object
6. 所有字段默认 required
7. content_type 从 header 获取
8. tool.name 使用 path 推导（snake_case）

【输入】
{query}

【输出】
"""