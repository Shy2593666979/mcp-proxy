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
                        <button class="task-delete-btn" onclick="deleteTask('${task.id}', event)" title="删除">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
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

// 删除任务
async function deleteTask(taskId, event) {
    // 阻止事件冒泡，避免触发选择任务
    event.stopPropagation();
    
    try {
        const response = await fetch(`${API_BASE}/task/delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                task_id: taskId
            })
        });
        
        const result = await response.json();
        
        if (result.status_code === 200) {
            // 如果删除的是当前任务，清空聊天区域
            if (taskId === currentTaskId) {
                currentTaskId = null;
                const chatMessages = document.getElementById('chatMessages');
                chatMessages.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">💬</div>
                        <div class="empty-state-text">开始新的对话</div>
                        <div class="empty-state-hint">选择或创建一个对话开始聊天</div>
                    </div>
                `;
            }
            
            // 重新加载任务列表
            await loadTaskList();
        } else {
            console.error('删除任务失败:', result);
            alert('删除对话失败');
        }
    } catch (error) {
        console.error('删除任务失败:', error);
        alert('删除对话失败');
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
                    } else if (item.type === 'interrupt') {
                        // 处理 interrupt 类型
                        blocks.push({ type: 'interrupt', data: item.data });
                    }
                });

                const blocksHtml = blocks.map(block => {
                    if (block.type === 'text') {
                        const rendered = typeof marked !== 'undefined'
                            ? marked.parse(block.data)
                            : escapeHtml(block.data);
                        return `<div class="text-container">${rendered}</div>`;
                    } else if (block.type === 'event') {
                        const ev = block.ev;
                        const status = ev.is_error ? 'ERROR' : (ev.status || 'END');
                        const message = ev.content || '';
                        const statusText = status === 'START' ? '进行中' : status === 'END' ? '已完成' : '失败';
                        return `<div class="event-item ${status}"><div class="event-header" onclick="toggleEventMessage(this)"><span class="event-icon"></span><span class="event-title">${escapeHtml(ev.title || '事件')}</span><span class="event-status">${statusText}</span><span class="event-toggle">展开</span></div><div class="event-message">${escapeHtml(message)}</div></div>`;
                    } else if (block.type === 'interrupt') {
                        // 渲染历史 interrupt，根据 status 判断是否显示按钮
                        const interruptData = block.data;
                        const actionRequests = interruptData.action_requests || [];
                        const allowedDecisions = interruptData.allowed_decisions || [];
                        const status = interruptData.status; // false = 未处理，true = 已处理
                        const description = actionRequests.length > 0 ? actionRequests[0].description : '';
                        
                        // 渲染描述（支持 markdown）
                        const rendered = typeof marked !== 'undefined'
                            ? marked.parse(description)
                            : escapeHtml(description);
                        
                        let buttonsHtml = '';
                        if (status === false) {
                            // 未处理，显示按钮（需要重新绑定事件）
                            let approveBtn = '';
                            let rejectBtn = '';
                            
                            if (allowedDecisions.includes('approve')) {
                                approveBtn = '<button class="interrupt-btn interrupt-btn-approve" onclick="handleHistoryInterruptApprove(this)">确认创建</button>';
                            }
                            if (allowedDecisions.includes('reject')) {
                                rejectBtn = '<button class="interrupt-btn interrupt-btn-reject" onclick="handleHistoryInterruptReject(this)">取消并修改</button>';
                            }
                            
                            buttonsHtml = `<div class="interrupt-buttons">${approveBtn}${rejectBtn}</div>`;
                        } else {
                            // 已处理，显示提示
                            buttonsHtml = '<div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">（已处理）</div>';
                        }
                        
                        const opacityStyle = status === false ? '' : 'opacity: 0.6;';
                        return `<div class="interrupt-container" style="${opacityStyle}"><div class="interrupt-description">${rendered}</div>${buttonsHtml}</div>`;
                    }
                    return '';
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
    
    // 添加加载指示器（只有三个跳动的点）
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = `
        <span></span>
        <span></span>
        <span></span>
    `;
    contentDiv.appendChild(loadingIndicator);
    
    scrollToBottom();

    // 按顺序追踪当前块
    const eventMap = new Map();   // title -> eventItem（用于更新已有事件）
    let currentTextContainer = null;  // 当前正在追加的文本块
    let currentTextContent = '';      // 当前文本块的累积内容

    // 处理 interrupt 事件（HITL 确认）
    function handleInterrupt(interruptData, container) {
        // 关闭当前文本块，interrupt 单独一块
        currentTextContainer = null;
        currentTextContent = '';

        const allowedDecisions = interruptData.allowed_decisions || [];
        const actionRequests = interruptData.action_requests || [];
        const status = interruptData.status; // false = 未处理，true = 已处理
        
        // 创建 interrupt 容器
        const interruptContainer = document.createElement('div');
        interruptContainer.className = 'interrupt-container';
        
        // 显示描述信息（支持 markdown）
        if (actionRequests.length > 0 && actionRequests[0].description) {
            const descDiv = document.createElement('div');
            descDiv.className = 'interrupt-description';
            const rendered = typeof marked !== 'undefined'
                ? marked.parse(actionRequests[0].description)
                : escapeHtml(actionRequests[0].description);
            descDiv.innerHTML = rendered;
            interruptContainer.appendChild(descDiv);
        }
        
        // 只有当 status 为 false（未处理）时才显示按钮
        if (status === false) {
            // 创建按钮容器
            const buttonsDiv = document.createElement('div');
            buttonsDiv.className = 'interrupt-buttons';
            
            // 根据 allowed_decisions 显示按钮
            if (allowedDecisions.includes('approve')) {
                const approveBtn = document.createElement('button');
                approveBtn.className = 'interrupt-btn interrupt-btn-approve';
                approveBtn.textContent = '确认创建';
                approveBtn.onclick = () => handleHitlApprove(interruptContainer);
                buttonsDiv.appendChild(approveBtn);
            }
            
            if (allowedDecisions.includes('reject')) {
                const rejectBtn = document.createElement('button');
                rejectBtn.className = 'interrupt-btn interrupt-btn-reject';
                rejectBtn.textContent = '取消并修改';
                rejectBtn.onclick = () => handleHitlReject(interruptContainer);
                buttonsDiv.appendChild(rejectBtn);
            }
            
            interruptContainer.appendChild(buttonsDiv);
        } else {
            // status 为 true，表示已处理，显示提示
            const processedDiv = document.createElement('div');
            processedDiv.style.fontSize = '12px';
            processedDiv.style.color = 'var(--text-secondary)';
            processedDiv.style.marginTop = '8px';
            processedDiv.textContent = '（已处理）';
            interruptContainer.appendChild(processedDiv);
            
            // 已处理的容器添加半透明效果
            interruptContainer.style.opacity = '0.6';
        }
        
        container.appendChild(interruptContainer);
        scrollToBottom();
    }

    // 处理 HITL approve
    async function handleHitlApprove(interruptContainer) {
        // 禁用所有按钮
        const buttons = interruptContainer.querySelectorAll('.interrupt-btn');
        buttons.forEach(btn => btn.disabled = true);
        
        try {
            const response = await fetch(`${API_BASE}/completion/hitl/approve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    task_id: currentTaskId
                })
            });
            
            // 移除 interrupt 容器
            interruptContainer.remove();
            
            // 处理流式响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataContent = line.substring(6).trim();
                        if (dataContent === 'DONE') continue;
                        
                        try {
                            const data = JSON.parse(dataContent);
                            if (data.type === 'text') {
                                appendText(data.content);
                            } else if (data.type === 'event') {
                                updateEvent(data.event || data);
                            } else if (data.type === 'interrupt') {
                                handleInterrupt(data.event || data, contentDiv);
                            }
                        } catch (error) {
                            console.error('解析消息失败:', error);
                        }
                    }
                }
            }
            
            await loadTaskList();
        } catch (error) {
            console.error('Approve 失败:', error);
            contentDiv.innerHTML += '<div class="error-message">操作失败，请重试</div>';
        }
    }

    // 处理 HITL reject
    async function handleHitlReject(interruptContainer) {
        // 禁用所有按钮
        const buttons = interruptContainer.querySelectorAll('.interrupt-btn');
        buttons.forEach(btn => btn.disabled = true);
        
        // 显示输入框让用户输入修改意见
        const feedbackDiv = document.createElement('div');
        feedbackDiv.className = 'interrupt-feedback';
        feedbackDiv.innerHTML = `
            <textarea class="interrupt-feedback-input" placeholder="请输入修改意见（留空则直接取消）"></textarea>
            <div class="interrupt-feedback-buttons">
                <button class="interrupt-btn interrupt-btn-secondary" onclick="this.closest('.interrupt-container').querySelector('.interrupt-feedback').remove(); this.closest('.interrupt-container').querySelectorAll('.interrupt-btn').forEach(b => b.disabled = false);">取消</button>
                <button class="interrupt-btn interrupt-btn-primary" onclick="submitHitlReject(this)">提交</button>
            </div>
        `;
        interruptContainer.appendChild(feedbackDiv);
        feedbackDiv.querySelector('textarea').focus();
        scrollToBottom();
    }

    // 提交 reject（全局函数，供内联 onclick 调用）
    window.submitHitlReject = async function(btnElement) {
        const interruptContainer = btnElement.closest('.interrupt-container');
        const feedbackInput = interruptContainer.querySelector('.interrupt-feedback-input');
        const feedback = feedbackInput.value.trim();
        
        // 禁用提交按钮
        btnElement.disabled = true;
        
        try {
            const response = await fetch(`${API_BASE}/completion/hitl/reject`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    task_id: currentTaskId,
                    feedback: feedback
                })
            });
            
            // 移除 interrupt 容器
            interruptContainer.remove();
            
            // 处理流式响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataContent = line.substring(6).trim();
                        if (dataContent === 'DONE') continue;
                        
                        try {
                            const data = JSON.parse(dataContent);
                            if (data.type === 'text') {
                                appendText(data.content);
                            } else if (data.type === 'event') {
                                updateEvent(data.event || data);
                            } else if (data.type === 'interrupt') {
                                handleInterrupt(data.event || data, contentDiv);
                            }
                        } catch (error) {
                            console.error('解析消息失败:', error);
                        }
                    }
                }
            }
            
            await loadTaskList();
        } catch (error) {
            console.error('Reject 失败:', error);
            contentDiv.innerHTML += '<div class="error-message">操作失败，请重试</div>';
        }
    };

    // 处理历史 interrupt 的 approve（全局函数）
    window.handleHistoryInterruptApprove = async function(btnElement) {
        const interruptContainer = btnElement.closest('.interrupt-container');
        const buttons = interruptContainer.querySelectorAll('.interrupt-btn');
        buttons.forEach(btn => btn.disabled = true);
        
        try {
            const response = await fetch(`${API_BASE}/completion/hitl/approve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    task_id: currentTaskId
                })
            });
            
            // 移除 interrupt 容器
            interruptContainer.remove();
            
            // 找到 contentDiv：先尝试找 message-group，如果找不到就找最近的 markdown-body
            let contentDiv = null;
            const messageGroup = document.querySelector('.message-group.assistant:last-child');
            
            if (messageGroup) {
                contentDiv = messageGroup.querySelector('.message-content.markdown-body');
            }
            
            // 如果还是找不到，创建一个新的消息组
            if (!contentDiv) {
                const chatMessages = document.getElementById('chatMessages');
                const assistantMessageGroup = document.createElement('div');
                assistantMessageGroup.className = 'message-group assistant';
                
                const avatar = document.createElement('div');
                avatar.className = 'message-avatar';
                avatar.innerHTML = '<img src="robot.svg" alt="assistant">';
                
                const contentWrapper = document.createElement('div');
                contentWrapper.className = 'message-content-wrapper';
                
                contentDiv = document.createElement('div');
                contentDiv.className = 'message-content markdown-body';
                contentWrapper.appendChild(contentDiv);

                assistantMessageGroup.appendChild(avatar);
                assistantMessageGroup.appendChild(contentWrapper);
                chatMessages.appendChild(assistantMessageGroup);
            }
            
            // 处理流式响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            
            const eventMap = new Map();
            let currentTextContainer = null;
            let currentTextContent = '';
            
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
            
            function updateEvent(eventData) {
                const title = eventData.title || '事件';
                const status = eventData.is_error ? 'ERROR' : (eventData.status || 'START');
                const message = eventData.content || '';
                const statusText = status === 'START' ? '进行中' : status === 'END' ? '已完成' : '失败';

                let eventItem = eventMap.get(title);

                if (!eventItem) {
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
                    eventItem.className = `event-item ${status}`;
                    eventItem.querySelector('.event-status').textContent = statusText;
                    if (message) {
                        eventItem.querySelector('.event-message').textContent = message;
                    }
                }

                scrollToBottom();
            }
            
            function handleInterrupt(interruptData, container) {
                currentTextContainer = null;
                currentTextContent = '';

                const allowedDecisions = interruptData.allowed_decisions || [];
                const actionRequests = interruptData.action_requests || [];
                const status = interruptData.status;
                
                const interruptContainer = document.createElement('div');
                interruptContainer.className = 'interrupt-container';
                
                if (actionRequests.length > 0 && actionRequests[0].description) {
                    const descDiv = document.createElement('div');
                    descDiv.className = 'interrupt-description';
                    const rendered = typeof marked !== 'undefined'
                        ? marked.parse(actionRequests[0].description)
                        : escapeHtml(actionRequests[0].description);
                    descDiv.innerHTML = rendered;
                    interruptContainer.appendChild(descDiv);
                }
                
                if (status === false) {
                    const buttonsDiv = document.createElement('div');
                    buttonsDiv.className = 'interrupt-buttons';
                    
                    if (allowedDecisions.includes('approve')) {
                        const approveBtn = document.createElement('button');
                        approveBtn.className = 'interrupt-btn interrupt-btn-approve';
                        approveBtn.textContent = '确认创建';
                        approveBtn.onclick = () => window.handleHistoryInterruptApprove(approveBtn);
                        buttonsDiv.appendChild(approveBtn);
                    }
                    
                    if (allowedDecisions.includes('reject')) {
                        const rejectBtn = document.createElement('button');
                        rejectBtn.className = 'interrupt-btn interrupt-btn-reject';
                        rejectBtn.textContent = '取消并修改';
                        rejectBtn.onclick = () => window.handleHistoryInterruptReject(rejectBtn);
                        buttonsDiv.appendChild(rejectBtn);
                    }
                    
                    interruptContainer.appendChild(buttonsDiv);
                }
                
                container.appendChild(interruptContainer);
                scrollToBottom();
            }
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataContent = line.substring(6).trim();
                        if (dataContent === 'DONE') continue;
                        
                        try {
                            const data = JSON.parse(dataContent);
                            if (data.type === 'text') {
                                appendText(data.content);
                            } else if (data.type === 'event') {
                                updateEvent(data.event || data);
                            } else if (data.type === 'interrupt') {
                                handleInterrupt(data.event || data, contentDiv);
                            }
                        } catch (error) {
                            console.error('解析消息失败:', error);
                        }
                    }
                }
            }
            
            await loadTaskList();
        } catch (error) {
            console.error('Approve 失败:', error);
            alert('操作失败，请重试');
        }
    };

    // 处理历史 interrupt 的 reject（全局函数）
    window.handleHistoryInterruptReject = async function(btnElement) {
        const interruptContainer = btnElement.closest('.interrupt-container');
        const buttons = interruptContainer.querySelectorAll('.interrupt-btn');
        buttons.forEach(btn => btn.disabled = true);
        
        // 显示输入框让用户输入修改意见
        const feedbackDiv = document.createElement('div');
        feedbackDiv.className = 'interrupt-feedback';
        feedbackDiv.innerHTML = `
            <textarea class="interrupt-feedback-input" placeholder="请输入修改意见（留空则直接取消）"></textarea>
            <div class="interrupt-feedback-buttons">
                <button class="interrupt-btn interrupt-btn-secondary" onclick="this.closest('.interrupt-feedback').remove(); this.closest('.interrupt-container').querySelectorAll('.interrupt-btn').forEach(b => b.disabled = false);">取消</button>
                <button class="interrupt-btn interrupt-btn-primary" onclick="submitHistoryHitlReject(this)">提交</button>
            </div>
        `;
        interruptContainer.appendChild(feedbackDiv);
        feedbackDiv.querySelector('textarea').focus();
        scrollToBottom();
    };

    // 提交历史 interrupt 的 reject（全局函数）
    window.submitHistoryHitlReject = async function(btnElement) {
        const interruptContainer = btnElement.closest('.interrupt-container');
        const feedbackInput = interruptContainer.querySelector('.interrupt-feedback-input');
        const feedback = feedbackInput.value.trim();
        
        btnElement.disabled = true;
        
        try {
            const response = await fetch(`${API_BASE}/completion/hitl/reject`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    task_id: currentTaskId,
                    feedback: feedback
                })
            });
            
            // 移除 interrupt 容器
            interruptContainer.remove();
            
            // 找到 contentDiv：先尝试找 message-group，如果找不到就找最近的 markdown-body
            let contentDiv = null;
            const messageGroup = document.querySelector('.message-group.assistant:last-child');
            
            if (messageGroup) {
                contentDiv = messageGroup.querySelector('.message-content.markdown-body');
            }
            
            // 如果还是找不到，创建一个新的消息组
            if (!contentDiv) {
                const chatMessages = document.getElementById('chatMessages');
                const assistantMessageGroup = document.createElement('div');
                assistantMessageGroup.className = 'message-group assistant';
                
                const avatar = document.createElement('div');
                avatar.className = 'message-avatar';
                avatar.innerHTML = '<img src="robot.svg" alt="assistant">';
                
                const contentWrapper = document.createElement('div');
                contentWrapper.className = 'message-content-wrapper';
                
                contentDiv = document.createElement('div');
                contentDiv.className = 'message-content markdown-body';
                contentWrapper.appendChild(contentDiv);

                assistantMessageGroup.appendChild(avatar);
                assistantMessageGroup.appendChild(contentWrapper);
                chatMessages.appendChild(assistantMessageGroup);
            }
            
            // 处理流式响应（与 approve 相同的逻辑）
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            
            const eventMap = new Map();
            let currentTextContainer = null;
            let currentTextContent = '';
            
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
            
            function updateEvent(eventData) {
                const title = eventData.title || '事件';
                const status = eventData.is_error ? 'ERROR' : (eventData.status || 'START');
                const message = eventData.content || '';
                const statusText = status === 'START' ? '进行中' : status === 'END' ? '已完成' : '失败';

                let eventItem = eventMap.get(title);

                if (!eventItem) {
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
                    eventItem.className = `event-item ${status}`;
                    eventItem.querySelector('.event-status').textContent = statusText;
                    if (message) {
                        eventItem.querySelector('.event-message').textContent = message;
                    }
                }

                scrollToBottom();
            }
            
            function handleInterrupt(interruptData, container) {
                currentTextContainer = null;
                currentTextContent = '';

                const allowedDecisions = interruptData.allowed_decisions || [];
                const actionRequests = interruptData.action_requests || [];
                const status = interruptData.status;
                
                const interruptContainer = document.createElement('div');
                interruptContainer.className = 'interrupt-container';
                
                if (actionRequests.length > 0 && actionRequests[0].description) {
                    const descDiv = document.createElement('div');
                    descDiv.className = 'interrupt-description';
                    const rendered = typeof marked !== 'undefined'
                        ? marked.parse(actionRequests[0].description)
                        : escapeHtml(actionRequests[0].description);
                    descDiv.innerHTML = rendered;
                    interruptContainer.appendChild(descDiv);
                }
                
                if (status === false) {
                    const buttonsDiv = document.createElement('div');
                    buttonsDiv.className = 'interrupt-buttons';
                    
                    if (allowedDecisions.includes('approve')) {
                        const approveBtn = document.createElement('button');
                        approveBtn.className = 'interrupt-btn interrupt-btn-approve';
                        approveBtn.textContent = '确认创建';
                        approveBtn.onclick = () => window.handleHistoryInterruptApprove(approveBtn);
                        buttonsDiv.appendChild(approveBtn);
                    }
                    
                    if (allowedDecisions.includes('reject')) {
                        const rejectBtn = document.createElement('button');
                        rejectBtn.className = 'interrupt-btn interrupt-btn-reject';
                        rejectBtn.textContent = '取消并修改';
                        rejectBtn.onclick = () => window.handleHistoryInterruptReject(rejectBtn);
                        buttonsDiv.appendChild(rejectBtn);
                    }
                    
                    interruptContainer.appendChild(buttonsDiv);
                }
                
                container.appendChild(interruptContainer);
                scrollToBottom();
            }
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataContent = line.substring(6).trim();
                        if (dataContent === 'DONE') continue;
                        
                        try {
                            const data = JSON.parse(dataContent);
                            if (data.type === 'text') {
                                appendText(data.content);
                            } else if (data.type === 'event') {
                                updateEvent(data.event || data);
                            } else if (data.type === 'interrupt') {
                                handleInterrupt(data.event || data, contentDiv);
                            }
                        } catch (error) {
                            console.error('解析消息失败:', error);
                        }
                    }
                }
            }
            
            await loadTaskList();
        } catch (error) {
            console.error('Reject 失败:', error);
            alert('操作失败，请重试');
        }
    };

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
                    const dataContent = line.substring(6).trim();
                    
                    // 检查是否是 DONE 消息
                    if (dataContent === 'DONE') {
                        // 移除加载指示器
                        const loadingIndicator = contentDiv.querySelector('.loading-indicator');
                        if (loadingIndicator) {
                            loadingIndicator.remove();
                        }
                        continue;
                    }
                    
                    try {
                        const data = JSON.parse(dataContent);
                        
                        // 首次收到数据时移除加载指示器
                        const loadingIndicator = contentDiv.querySelector('.loading-indicator');
                        if (loadingIndicator) {
                            loadingIndicator.remove();
                        }
                        
                        if (data.type === 'text') {
                            appendText(data.content);
                        } else if (data.type === 'event') {
                            updateEvent(data.event || data);
                        } else if (data.type === 'interrupt') {
                            handleInterrupt(data.event || data, contentDiv);
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
