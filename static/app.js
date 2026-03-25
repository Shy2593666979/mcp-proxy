// 全局状态
let currentTaskId = null;
let isStreaming = false;

// API 基础路径
const API_BASE = '';

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    loadTaskList();
    autoResize(document.getElementById('messageInput'));
    loadTheme();
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

// 自动调整输入框高度
function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

// 格式化时间
function formatTime(dateStr) {
    if (!dateStr) return '刚刚';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
    
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

// 加载任务列表
async function loadTaskList() {
    try {
        const response = await fetch(`${API_BASE}/task/list`);
        const result = await response.json();
        
        const taskList = document.getElementById('taskList');
        
        if (result.data && result.data.length > 0) {
            taskList.innerHTML = result.data.map(task => {
                const lastMessage = task.messages && task.messages.length > 0 
                    ? task.messages[task.messages.length - 1].query 
                    : '新对话';
                const messageCount = task.messages?.length || 0;
                
                return `
                    <div class="task-item ${task.id === currentTaskId ? 'active' : ''}" 
                         onclick="selectTask('${task.id}', event)">
                        <div class="task-item-header">
                            <div class="task-item-title">${messageCount} 条消息</div>
                            <div class="task-item-time">${formatTime(task.created_time)}</div>
                        </div>
                        <div class="task-item-preview">${escapeHtml(lastMessage)}</div>
                    </div>
                `;
            }).join('');
        } else {
            taskList.innerHTML = '<div class="loading">暂无对话</div>';
        }
    } catch (error) {
        console.error('加载任务列表失败:', error);
        document.getElementById('taskList').innerHTML = '<div class="loading">加载失败</div>';
    }
}

// 创建新任务
async function createNewTask() {
    try {
        const response = await fetch(`${API_BASE}/task/create`, {
            method: 'POST'
        });
        const result = await response.json();
        
        if (result.data && result.data.id) {
            currentTaskId = result.data.id;
            await loadTaskList();
            
            // 清空聊天区域
            const chatMessages = document.getElementById('chatMessages');
            chatMessages.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💬</div>
                    <div class="empty-state-text">开始新的对话</div>
                    <div class="empty-state-hint">输入消息开始聊天</div>
                </div>
            `;
            
            // 聚焦输入框
            document.getElementById('messageInput').focus();
        }
    } catch (error) {
        console.error('创建任务失败:', error);
        alert('创建对话失败');
    }
}

// 选择任务
async function selectTask(taskId, event) {
    currentTaskId = taskId;
    
    // 更新任务列表选中状态
    document.querySelectorAll('.task-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.closest('.task-item')?.classList.add('active');
    
    // 加载任务消息
    await loadTaskMessages(taskId);
}

// 加载任务消息
async function loadTaskMessages(taskId) {
    try {
        const response = await fetch(`${API_BASE}/task/list`);
        const result = await response.json();
        
        const task = result.data.find(t => t.id === taskId);
        const chatMessages = document.getElementById('chatMessages');
        
        if (task && task.messages && task.messages.length > 0) {
            chatMessages.innerHTML = task.messages.map(msg => {
                const content = msg.content || [];

                // 按顺序构建块列表：连续 text 合并为一块，event 单独一块
                const blocks = [];
                const eventMap = new Map(); // title -> block index，用于原地更新

                content.forEach(item => {
                    if (item.type === 'text') {
                        const last = blocks[blocks.length - 1];
                        if (last && last.type === 'text') {
                            last.data += item.data;
                        } else {
                            blocks.push({ type: 'text', data: item.data });
                        }
                    } else if (item.type === 'event') {
                        const ev = item.data;
                        const title = ev.title || '事件';
                        const existingIdx = eventMap.get(title);
                        if (existingIdx !== undefined) {
                            // 原地更新已有事件块
                            blocks[existingIdx].ev = ev;
                        } else {
                            eventMap.set(title, blocks.length);
                            blocks.push({ type: 'event', ev });
                        }
                    }
                });

                const blocksHtml = blocks.map(block => {
                    if (block.type === 'text') {
                        const rendered = typeof marked !== 'undefined'
                            ? marked.parse(block.data)
                            : escapeHtml(block.data);
                        return `<div class="text-container">${rendered}</div>`;
                    } else {
                        const ev = block.ev;
                        const status = ev.is_error ? 'ERROR' : (ev.status || 'END');
                        const message = ev.content || '';
                        const statusText = status === 'START' ? '进行中' : status === 'END' ? '已完成' : '失败';
                        return `<div class="event-item ${status}"><div class="event-header" onclick="toggleEventMessage(this)"><span class="event-icon"></span><span class="event-title">${escapeHtml(ev.title || '事件')}</span><span class="event-status">${statusText}</span><span class="event-toggle">展开</span></div><div class="event-message">${escapeHtml(message)}</div></div>`;
                    }
                }).join('');

                return `
                    <div class="message-group user">
                        <div class="message-content-wrapper">
                            <div class="message-content">${escapeHtml(msg.query)}</div>
                        </div>
                        <div class="message-avatar"><img src="user.svg" alt="user"></div>
                    </div>
                    <div class="message-group assistant">
                        <div class="message-avatar"><img src="robot.svg" alt="assistant"></div>
                        <div class="message-content-wrapper">
                            <div class="message-content markdown-body">${blocksHtml}</div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            chatMessages.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💬</div>
                    <div class="empty-state-text">开始对话</div>
                    <div class="empty-state-hint">输入消息开始聊天</div>
                </div>
            `;
        }
        
        scrollToBottom();
    } catch (error) {
        console.error('加载消息失败:', error);
    }
}

// 切换事件消息展开/折叠
function toggleEventMessage(headerElement) {
    const eventItem = headerElement.closest('.event-item');
    const messageDiv = eventItem.querySelector('.event-message');
    const toggleSpan = headerElement.querySelector('.event-toggle');
    
    if (messageDiv.classList.contains('show')) {
        messageDiv.classList.remove('show');
        toggleSpan.textContent = '展开';
    } else {
        messageDiv.classList.add('show');
        toggleSpan.textContent = '收起';
    }
}

// 发送消息
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const query = input.value.trim();
    
    if (!query) {
        return;
    }
    
    if (isStreaming) {
        alert('正在处理中，请稍候');
        return;
    }
    
    // 如果没有当前任务，自动创建一个
    if (!currentTaskId) {
        try {
            const response = await fetch(`${API_BASE}/task/create`, { method: 'POST' });
            const result = await response.json();
            if (result.data && result.data.id) {
                currentTaskId = result.data.id;
                await loadTaskList();
            } else {
                alert('创建对话失败');
                return;
            }
        } catch (error) {
            console.error('创建任务失败:', error);
            alert('创建对话失败');
            return;
        }
    }
    
    // 清空输入框并重置高度
    input.value = '';
    autoResize(input);
    
    // 禁用发送按钮
    const sendBtn = document.getElementById('sendBtn');
    sendBtn.disabled = true;
    isStreaming = true;
    
    // 清空空状态
    const chatMessages = document.getElementById('chatMessages');
    const emptyState = chatMessages.querySelector('.empty-state');
    if (emptyState) {
        chatMessages.innerHTML = '';
    }
    
    // 添加用户消息到界面
    const userMessageGroup = document.createElement('div');
    userMessageGroup.className = 'message-group user';
    userMessageGroup.innerHTML = `
        <div class="message-content-wrapper">
            <div class="message-content">${escapeHtml(query)}</div>
        </div>
        <div class="message-avatar"><img src="user.svg" alt="user"></div>
    `;
    chatMessages.appendChild(userMessageGroup);
    
    // 创建 AI 回复容器
    const assistantMessageGroup = document.createElement('div');
    assistantMessageGroup.className = 'message-group assistant';
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = '<img src="robot.svg" alt="assistant">';
    
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content-wrapper';
    
    // 外层消息容器
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content markdown-body';
    contentWrapper.appendChild(contentDiv);

    assistantMessageGroup.appendChild(avatar);
    assistantMessageGroup.appendChild(contentWrapper);
    chatMessages.appendChild(assistantMessageGroup);
    scrollToBottom();

    // 按顺序追踪当前块
    const eventMap = new Map();   // title -> eventItem（用于更新已有事件）
    let currentTextContainer = null;  // 当前正在追加的文本块
    let currentTextContent = '';      // 当前文本块的累积内容

    // 更新或创建事件（在当前位置插入，之后文本另起新块）
    function updateEvent(eventData) {
        const title = eventData.title || '事件';
        const status = eventData.is_error ? 'ERROR' : (eventData.status || 'START');
        const message = eventData.content || '';
        const statusText = status === 'START' ? '进行中' : status === 'END' ? '已完成' : '失败';

        let eventItem = eventMap.get(title);

        if (!eventItem) {
            // 新事件：顺序插入到 contentDiv 末尾
            // 同时关闭当前文本块，下次 text 另起新块
            currentTextContainer = null;
            currentTextContent = '';

            eventItem = document.createElement('div');
            eventItem.className = `event-item ${status}`;
            eventItem.innerHTML = `
                <div class="event-header" onclick="toggleEventMessage(this)">
                    <span class="event-icon"></span>
                    <span class="event-title">${escapeHtml(title)}</span>
                    <span class="event-status">${statusText}</span>
                    <span class="event-toggle">展开</span>
                </div>
                <div class="event-message">${escapeHtml(message)}</div>
            `;
            contentDiv.appendChild(eventItem);
            eventMap.set(title, eventItem);
        } else {
            // 已有事件：原地更新状态，不移动位置
            eventItem.className = `event-item ${status}`;
            eventItem.querySelector('.event-status').textContent = statusText;
            if (message) {
                eventItem.querySelector('.event-message').textContent = message;
            }
        }

        scrollToBottom();
    }

    // 追加文本：连续 text 复用同一个块，event 之后另起新块
    function appendText(text) {
        if (!currentTextContainer) {
            currentTextContainer = document.createElement('div');
            currentTextContainer.className = 'text-container';
            contentDiv.appendChild(currentTextContainer);
            currentTextContent = '';
        }
        currentTextContent += text;
        currentTextContainer.innerHTML = typeof marked !== 'undefined'
            ? marked.parse(currentTextContent)
            : escapeHtml(currentTextContent);
        scrollToBottom();
    }
    
    // 使用 fetch 发送 POST 请求并处理流式响应
    try {
        const response = await fetch(`${API_BASE}/completion`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: query,
                task_id: currentTaskId
            })
        });
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            
            // 按换行切割，保留最后一个不完整的行
            const lines = buffer.split('\n');
            buffer = lines.pop(); // 最后一段可能不完整，留到下次
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.substring(6));
                        
                        if (data.type === 'text') {
                            appendText(data.content);
                        } else if (data.type === 'event') {
                            updateEvent(data.event || data);
                        }
                    } catch (error) {
                        console.error('解析消息失败:', error, '原始数据:', line);
                    }
                }
            }
        }
        
        // 完成后重新加载
        isStreaming = false;
        sendBtn.disabled = false;
        await loadTaskList();
        
    } catch (error) {
        console.error('请求失败:', error);
        isStreaming = false;
        sendBtn.disabled = false;
        contentDiv.textContent += '\n\n[错误: 请求失败]';
    }
}

// 处理键盘事件
function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// 滚动到底部
function scrollToBottom() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// HTML 转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
