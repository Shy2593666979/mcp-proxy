// API 基础路径
const API_BASE = '';

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    loadMcpList();
});

// 主题切换
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// 加载 MCP 列表
async function loadMcpList() {
    const mcpList = document.getElementById('mcpList');
    
    try {
        mcpList.innerHTML = '<div class="loading">加载中...</div>';
        
        const response = await fetch(`${API_BASE}/mcp/list`);
        const result = await response.json();
        
        if (result.status_code === 200 && result.data && result.data.length > 0) {
            mcpList.innerHTML = result.data.map(mcp => {
                const tools = mcp.mcp_tools || [];
                const toolCount = tools.length;
                const description = mcp.description || '暂无描述';
                const remoteUrl = mcp.remote_url || '';
                
                // 生成工具列表 HTML
                const toolsHtml = tools.map(tool => `
                    <div class="tool-item">
                        <div class="tool-item-name">${escapeHtml(tool.name)}</div>
                        <div class="tool-item-description">${escapeHtml(tool.description || '暂无描述')}</div>
                    </div>
                `).join('');
                
                return `
                    <div class="mcp-card">
                        <div class="mcp-card-header">
                            <div>
                                <div class="mcp-card-title">${escapeHtml(mcp.name || 'Unnamed MCP')}</div>
                            </div>
                        </div>
                        <div class="mcp-card-description">${escapeHtml(description)}</div>
                        <div class="mcp-card-footer">
                            <div class="mcp-card-footer-left">
                                <div class="mcp-card-tools">
                                    <div class="mcp-card-tools-btn">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                                        </svg>
                                        <span>${toolCount} 个工具</span>
                                    </div>
                                    ${toolCount > 0 ? `
                                        <div class="mcp-card-tools-dropdown">
                                            ${toolsHtml}
                                        </div>
                                    ` : ''}
                                </div>
                                ${remoteUrl ? `
                                    <div class="mcp-card-remote-url">
                                        <div class="mcp-card-remote-url-btn">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                                            </svg>
                                            <span>远程链接</span>
                                        </div>
                                        <div class="mcp-card-remote-url-dropdown">
                                            <div class="remote-url-content">
                                                <div class="remote-url-text">${escapeHtml(remoteUrl)}</div>
                                                <button class="remote-url-copy-btn" onclick="copyRemoteUrl('${escapeHtml(remoteUrl)}', event)">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                                    </svg>
                                                    <span>复制链接</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                            <div class="mcp-card-transport">${mcp.transport || 'sse'}</div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            mcpList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <div class="empty-state-text">暂无 MCP 服务</div>
                </div>
            `;
        }
    } catch (error) {
        console.error('加载 MCP 列表失败:', error);
        mcpList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <div class="empty-state-text">加载失败</div>
            </div>
        `;
    }
}

// 打开 JSON 模态框
function openJsonModal() {
    const modal = document.getElementById('jsonModal');
    
    if (!modal) {
        console.error('Modal element not found!');
        return;
    }
    
    const errorMessage = document.getElementById('errorMessage');
    const mcpName = document.getElementById('mcpName');
    const mcpDescription = document.getElementById('mcpDescription');
    const mcpTransport = document.getElementById('mcpTransport');
    const openapiSchema = document.getElementById('openapiSchema');
    
    // 清空所有输入（如果元素存在）
    if (mcpName) mcpName.value = '';
    if (mcpDescription) mcpDescription.value = '';
    if (mcpTransport) mcpTransport.value = 'sse';
    if (openapiSchema) openapiSchema.value = '';
    if (errorMessage) errorMessage.style.display = 'none';
    
    modal.classList.add('show');
}

// 关闭 JSON 模态框
function closeJsonModal() {
    const modal = document.getElementById('jsonModal');
    modal.classList.remove('show');
}

// 提交 JSON
async function submitJson() {
    const errorMessage = document.getElementById('errorMessage');
    const name = document.getElementById('mcpName').value.trim();
    const description = document.getElementById('mcpDescription').value.trim();
    const transport = document.getElementById('mcpTransport').value;
    const openapiSchemaText = document.getElementById('openapiSchema').value.trim();
    
    // 隐藏之前的错误信息
    errorMessage.style.display = 'none';
    
    // 验证必填字段
    if (!name) {
        showError('请输入服务名称');
        return;
    }
    
    if (!openapiSchemaText) {
        showError('请输入 OpenAPI Schema');
        return;
    }
    
    try {
        // 验证 OpenAPI Schema JSON 格式
        const openapiSchema = JSON.parse(openapiSchemaText);
        
        // 构建请求数据
        const requestData = {
            name: name,
            openapi_schema: openapiSchema,
            transport: transport
        };
        
        // 添加可选字段
        if (description) {
            requestData.description = description;
        }
        
        // 发送请求
        const response = await fetch(`${API_BASE}/mcp/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });
        
        const result = await response.json();
        
        if (result.status_code === 200) {
            // 成功 - 关闭模态框并刷新列表
            closeJsonModal();
            await loadMcpList();
        } else {
            showError(result.status_message || '创建失败');
        }
    } catch (error) {
        if (error instanceof SyntaxError) {
            showError('OpenAPI Schema JSON 格式错误，请检查语法');
        } else {
            console.error('创建 MCP 失败:', error);
            showError('创建失败: ' + error.message);
        }
    }
}

// 显示错误信息
function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}

// HTML 转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 点击模态框外部关闭
document.getElementById('jsonModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'jsonModal') {
        closeJsonModal();
    }
});

// 复制到剪贴板
function copyToClipboard(text, event) {
    event.stopPropagation();
    
    navigator.clipboard.writeText(text).then(() => {
        // 显示复制成功提示
        const target = event.currentTarget;
        const originalTitle = target.title;
        target.title = '已复制！';
        
        // 2秒后恢复原标题
        setTimeout(() => {
            target.title = originalTitle;
        }, 2000);
    }).catch(err => {
        console.error('复制失败:', err);
        alert('复制失败，请手动复制');
    });
}

// 复制远程 URL
function copyRemoteUrl(url, event) {
    event.stopPropagation();
    
    navigator.clipboard.writeText(url).then(() => {
        const btn = event.currentTarget;
        const span = btn.querySelector('span');
        const originalText = span.textContent;
        span.textContent = '已复制！';
        
        setTimeout(() => {
            span.textContent = originalText;
        }, 2000);
    }).catch(err => {
        console.error('复制失败:', err);
        // 静默失败，不弹窗
    });
}
