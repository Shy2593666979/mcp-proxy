<div align="center">

<img src="https://github.com/user-attachments/assets/1821a2e1-2920-476f-80b7-be57532b4d8b" alt="alt text" width="70%">


**一个强大的 Model Context Protocol (MCP) 代理服务**

[![Python Version](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.135+-green.svg)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [使用指南](#-使用指南) • [API 文档](#-api-文档) • [贡献指南](#-贡献指南)

</div>

---

## ✨ 功能特性

### 🎯 核心功能

- **🤝 对话生成 MCP** - 通过智能对话引导，轻松创建和配置 MCP 服务
- **⚡ 一键生成 MCP** - 直接粘贴 OpenAPI JSON 配置，快速部署 MCP 服务
- **📊 可视化管理** - 美观的 Web 界面，实时查看和管理所有 MCP 服务
- **🔧 工具管理** - 直观展示每个 MCP 服务的工具列表和详细信息

### 🚀 技术亮点

- **双传输协议支持** - SSE (Server-Sent Events) 和 Streamable HTTP
- **实时流式响应** - 支持流式数据传输，提供流畅的用户体验
- **OpenAPI 集成** - 完全兼容 OpenAPI 3.1+ 规范
- **主题切换** - 内置黑夜/白天主题，适应不同使用场景
- **响应式设计** - 完美适配桌面和移动设备

---

## 📦 快速开始

### 前置要求

- Python 3.12 或更高版本
- MySQL 数据库（可选）
- Redis（可选）

### 安装步骤

1. **克隆仓库**

```bash
git clone https://github.com/shy2593666979/mcp-proxy.git
cd mcp-proxy
```

2. **安装依赖**

使用 `uv`（推荐）：

```bash
uv sync
```

或使用 `pip`：

```bash
pip install -e .
```

3. **配置环境**

复制配置文件并根据需要修改：

```bash
cp src/mcp_proxy/config.yaml.example src/mcp_proxy/config.yaml
```

4. **启动服务**

```bash
uvicorn mcp_proxy.main:app --reload --host 0.0.0.0 --port 7080
```

5. **访问界面**

打开浏览器访问：`http://localhost:7080`

---

## 🎨 使用指南

### 对话生成 MCP

1. 在主页点击 **"对话生成 MCP"** 卡片
2. 在聊天界面描述你想要创建的 MCP 服务
3. AI 助手会引导你完成配置过程
4. 自动生成并注册 MCP 服务

### 一键生成 MCP

1. 在主页点击 **"一键生成 MCP"** 卡片
2. 在弹出的编辑器中粘贴 OpenAPI JSON 配置
3. 点击 **"创建 MCP"** 按钮
4. 系统自动解析并注册服务

#### OpenAPI 配置示例

```json
{
  "openapi_schema": {
    "openapi": "3.1.0",
    "info": {
      "title": "My API",
      "version": "1.0.0",
      "description": "API description"
    },
    "paths": {
      "/users": {
        "get": {
          "summary": "Get users",
          "operationId": "getUsers",
          "responses": {
            "200": {
              "description": "Success"
            }
          }
        }
      }
    }
  },
  "name": "my_api",
  "transport": "sse",
  "description": "My custom API service"
}
```

### 管理 MCP 服务

- **查看列表** - 主页下方展示所有已创建的 MCP 服务
- **查看工具** - 鼠标悬停在工具按钮上，查看该服务的所有工具
- **刷新列表** - 点击刷新按钮更新服务列表

---

## 📚 API 文档

### 核心端点

#### MCP 管理

- `POST /mcp/register` - 注册新的 MCP 服务
- `GET /mcp/list` - 获取所有 MCP 服务列表

#### 任务管理

- `GET /task/list` - 获取所有对话任务
- `POST /task/create` - 创建新的对话任务
- `POST /task/delete` - 删除指定任务

#### 对话接口

- `POST /completion` - 发送消息并获取流式响应

### 完整 API 文档

启动服务后访问：`http://localhost:7080/docs`

---

## 🏗️ 项目结构

```
mcp-proxy/
├── src/mcp_proxy/
│   ├── api/              # API 路由
│   │   ├── completion.py
│   │   ├── register_mcp.py
│   │   └── register_task.py
│   ├── core/             # 核心逻辑
│   │   ├── agent.py
│   │   ├── execute_tool.py
│   │   └── schema_converter.py
│   ├── database/         # 数据库层
│   │   ├── dao/
│   │   └── models/
│   ├── schemas/          # 数据模型
│   ├── service/          # 业务逻辑
│   └── main.py           # 应用入口
├── static/               # 前端资源
│   ├── index.html        # 主页
│   ├── chat.html         # 聊天页面
│   ├── index.js
│   └── chat.js
└── pyproject.toml        # 项目配置
```

---

## 🛠️ 技术栈

### 后端

- **FastAPI** - 现代化的 Python Web 框架
- **SQLModel** - SQL 数据库的 Python ORM
- **LangChain** - AI 应用开发框架
- **OpenAI** - AI 模型集成
- **SSE-Starlette** - 服务器推送事件支持

### 前端

- **原生 JavaScript** - 无框架依赖，轻量高效
- **Marked.js** - Markdown 渲染
- **CSS Variables** - 主题系统

---

## 🤝 贡献指南

我们欢迎所有形式的贡献！

### 如何贡献

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 开发规范

- 遵循 PEP 8 代码规范
- 添加适当的注释和文档
- 确保所有测试通过
- 更新相关文档

---

## 📝 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

---

## 🙏 致谢

- [FastAPI](https://fastapi.tiangolo.com/) - 优秀的 Web 框架
- [LangChain](https://www.langchain.com/) - 强大的 AI 开发工具
- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP 协议规范

---

