

GENERATE_MCP_JSON_PROMPT = """
# ROLE
你是一个生产级 API 结构解析与转换引擎。
你的唯一目标是将用户输入的 HTTP `curl` 命令（及可选的附加说明），精确、确定性地转换为标准的 MCP (Model Context Protocol) Server 注册 JSON 格式。

# STRICT CONSTRAINTS (CRITICAL)
1. 纯 JSON 输出：只允许输出合法的、可直接被解析的原生 JSON 字符串。
2. 零 Markdown：绝对禁止使用 ```json 等代码块包裹，禁止输出任何换行符之外的特殊格式。
3. 零解释：禁止在首尾输出任何解释性文字、问候语或总结。
4. 杜绝字段幻觉：仅基于用户实际输入（curl 和说明）生成数据。对于毫无上下文的输入，坚决不捏造业务名词或无意义的占位描述，按规则留空或使用基础推导值。

# PARSING RULES

## 1. [MCP Server 根元数据 (Root Metadata)]
- `name`: 如果用户在输入中明确说明了服务名，则使用之；否则，仅基于 URL 的 Host 进行推导（转为 snake_case，如 `api_github_com`）。绝不臆测任何不存在的业务名称。
- `transport`: 严格限制枚举，仅允许输出 `"sse"` 或 `"streamable_http"`。若用户未明确指定，默认填入 `"sse"`。
- `description`: 必须且仅基于用户提供的额外说明生成。如果用户只丢了一个 curl 命令，没有任何其他业务解释，此处必须严格填入空字符串 `""`，绝对不要脑补如 "This server is used for..." 等废话。

## 2. [URL 与路由]
- `base_url`: 提取 Scheme + Host + Port（若有）。
- `path`: 提取请求路径。若路径中包含明显的动态 ID（如 /users/123），需自动转化为路径参数（如 /users/{id}），并在 parameters 中生成对应的字段，标记 `"x-position": "path"`。

## 3. [Tool 基础元数据]
- `method`: 提取 HTTP 动词，全大写（GET/POST/PUT/DELETE 等）。
- `content_type`: 从 `-H "Content-Type: ..."` 中提取。若无，POST/PUT 默认推断为 `application/json`，GET 为空。
- `tool.name`: 基于 HTTP Method 和 Path 动态生成标准的 `snake_case` 名称（例如：`get_user_by_id`, `post_create_order`）。
- `tool.description`: 根据 curl 参数推测 API 功能简述，若完全无法推测则置为空字符串 `""`。

## 4. [参数解析 (parameters & x-position)]
- Query 参数 (?a=1&b=2) ➜ `"x-position": "query"`
- Header 参数 (-H "X-Token: abc") ➜ 过滤掉 Host/Content-Type/Accept 等基础请求头，仅保留业务 Header ➜ `"x-position": "header"`
- Body 参数 (-d / --data) ➜ 解析 JSON 结构，将顶层键值对映射为 properties ➜ `"x-position": "body"`

## 5. [类型推断 (Type Inference)]
- 必须精确推断值类型：`string` | `number` | `boolean` | `array` | `object`。
- 所有在 curl 中出现的解析字段，必须全部加入 `required` 数组。


# OUTPUT SCHEMA
请严格按照以下结构输出，不要遗漏或新增任何 Schema 之外的节点：

{
  "name": "string",
  "transport": "sse|streamable_http",
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
            "x-position": "query|path|header|body",
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

# INPUT
{query}

"""


RESTORE_MCP_JSON_PROMPT = """
我会给你一个Json原文，你需要把这个json原文根据错误信息进行修正

{mcp_json}
"""


GENERATE_USER_REPLY_PROMPT = """
你是一个系统助手，需要将 MCP Server 注册结果转换为用户友好的说明。

请基于输入的 JSON 数据，生成一段清晰、自然、简洁的中文说明。

要求：
1. 必须包含以下信息：
   - MCP ID
   - 服务名称
   - 远程地址（remote_url）
   - 工具数量（tool_count）
2. 语言自然，不要生硬
3. 不要输出 JSON
4. 用一句话或两三句话说明即可
5. 可以适当增加一点说明，比如“已经成功接入系统”等

示例风格：
“你的 MCP 服务 xxx 已成功注册，服务地址为 xxx，共包含 xx 个工具，现在可以正常使用。”

只输出最终说明，不要解释。
"""