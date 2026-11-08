// Telegram Mini App - Kanban Board
let tg = window.Telegram?.WebApp;

if (!tg) {
    console.error('Telegram WebApp not available');
} else {
    tg.expand();
    tg.setHeaderColor('#1a1a2e');
    
    // Initialize after Telegram is ready
    if (tg.isVersionAtLeast('6.1')) {
        tg.onEvent('ready', () => console.log('Telegram WebApp ready'));
    }
}

const API_BASE = 'https://qzytyvfdymcwnoxxvdln.supabase.co/rest/v1';
let tasks = [];
let editingTask = null;

// Column mapping
const columns = {
    'todo': document.getElementById('todo'),
    'in_progress': document.getElementById('in_progress'),
    'blocked': document.getElementById('blocked'),
    'done': document.getElementById('done'),
    'canceled': document.getElementById('canceled')
};

console.log('Columns initialized:', columns);
console.log('Todo column exists:', !!columns.todo);

// Load tasks
async function loadTasks() {
    try {
        console.log('Loading tasks from API...');
        const res = await fetch(`${API_BASE}/tasks`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'apikey': 'sb_publishable_tFOJv36d8OqS9ykGljiZ9g_j94vLO0Z',
                'Authorization': 'Bearer sb_publishable_tFOJv36d8OqS9ykGljiZ9g_j94vLO0Z'
            }
        });
        
        console.log('Response status:', res.status);
        
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }
        
        const data = await res.json();
        console.log('Data received, type:', typeof data, 'isArray:', Array.isArray(data));
        
        tasks = Array.isArray(data) ? data : (data.data || []);
        console.log('Tasks loaded:', tasks.length);
        
        renderBoard();
        
        if (tg?.MainButton) {
            tg.MainButton.setText(`Загружено задач: ${tasks.length}`);
            tg.MainButton.show();
        }
    } catch (e) {
        console.error('Load failed:', e);
        if (tg) {
            tg.showPopup({
                message: `Ошибка загрузки: ${e.message}`,
                buttons: [{type: 'ok'}]
            });
        }
    }
}

// Render board
function renderBoard() {
    if (!columns.todo) {
        console.error('Column elements not found!');
        return;
    }
    
    // Clear all columns
    Object.values(columns).forEach(col => {
        if (col) col.innerHTML = '';
    });
    
    // Sort by priority then created
    const sorted = [...tasks].sort((a, b) => b.priority - a.priority);
    
    sorted.forEach(task => {
        const card = createCard(task);
        const col = columns[task.status];
        if (col) {
            col.appendChild(card);
        }
    });
    
    updateStats();
}

// Create card element
function createCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.dataset.id = task.id;
    card.draggable = true;
    
    const priorityColors = ['#666', '#4caf50', '#2196f3', '#ff9800', '#f44336'];
    const priorityLabels = ['Обычный', 'Низкий', 'Средний', 'Высокий', 'Критический'];
    
    card.innerHTML = `
        <div class="card-header">
            <span class="priority" style="background:${priorityColors[task.priority] || '#666'}">${priorityLabels[task.priority] || '普通'}</span>
        </div>
        <div class="card-title">${escapeHtml(task.title)}</div>
        ${task.body ? `<div class="card-body">${escapeHtml(task.body.substring(0, 50))}${task.body.length > 50 ? '...' : ''}</div>` : ''}
        <div class="card-footer">
            <span class="assignee">${task.assignee || 'Не назначен'}</span>
            <span class="time">${formatTime(task.created_at)}</span>
        </div>
    `;
    
    card.onclick = (e) => {
        if (!card.classList.contains('dragging')) {
            openEditModal(task);
        }
    };
    return card;
}

// Open edit modal
function openEditModal(task = null) {
    editingTask = task;
    const modal = document.getElementById('taskModal');
    const title = document.getElementById('taskTitle');
    const body = document.getElementById('taskBody');
    const status = document.getElementById('taskStatus');
    const assignee = document.getElementById('taskAssignee');
    const priority = document.getElementById('taskPriority');
    const deleteBtn = document.getElementById('deleteBtn');
    
    if (task) {
        document.getElementById('modalTitle').textContent = 'Редактировать задачу';
        title.value = task.title;
        body.value = task.body || '';
        status.value = task.status;
        assignee.value = task.assignee || '';
        priority.value = task.priority;
        deleteBtn.style.display = 'block';
    } else {
        document.getElementById('modalTitle').textContent = 'Новая задача';
        title.value = '';
        body.value = '';
        status.value = 'todo';
        assignee.value = '';
        priority.value = '2';
        deleteBtn.style.display = 'none';
    }
    
    modal.classList.add('active');
}

// Close modal
function closeModal() {
    document.getElementById('taskModal').classList.remove('active');
    editingTask = null;
}

// Save task
async function saveTask(e) {
    e.preventDefault();
    
    const title = document.getElementById('taskTitle').value.trim();
    const body = document.getElementById('taskBody').value.trim();
    const status = document.getElementById('taskStatus').value;
    const assignee = document.getElementById('taskAssignee').value;
    const priority = parseInt(document.getElementById('taskPriority').value);
    
    if (!title) {
        if (tg) tg.showPopup({ message: 'Введите название задачи', buttons: [{type: 'ok'}] });
        return;
    }
    
    const headers = {
        'Content-Type': 'application/json',
        'apikey': 'sb_publishable_tFOJv36d8OqS9ykGljiZ9g_j94vLO0Z',
        'Authorization': 'Bearer sb_publishable_tFOJv36d8OqS9ykGljiZ9g_j94vLO0Z',
        'Prefer': 'return=representation'
    };
    
    try {
        if (editingTask && editingTask.id) {
            await fetch(`${API_BASE}/tasks?id=eq.${editingTask.id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ id: editingTask.id, title, body, status, assignee, priority })
            });
        } else {
            const newId = 't_' + Math.random().toString(36).substr(2, 9);
            await fetch(`${API_BASE}/tasks`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ id: newId, title, body, status, assignee, priority })
            });
        }
        
        closeModal();
        await loadTasks();
        if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    } catch (e) {
        console.error('Save error:', e);
        if (tg) tg.showPopup({ message: 'Ошибка сохранения', buttons: [{type: 'ok'}] });
    }
}

// Delete task
async function deleteTask() {
    if (!editingTask || !editingTask.id) return;
    
    try {
        await fetch(`${API_BASE}/tasks?id=eq.${editingTask.id}`, {
            method: 'DELETE',
            headers: {
                'apikey': 'sb_publishable_tFOJv36d8OqS9ykGljiZ9g_j94vLO0Z',
                'Authorization': 'Bearer sb_publishable_tFOJv36d8OqS9ykGljiZ9g_j94vLO0Z'
            }
        });
        closeModal();
        await loadTasks();
        if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    } catch (e) {
        console.error('Delete error:', e);
        if (tg) tg.showPopup({ message: 'Ошибка удаления', buttons: [{type: 'ok'}] });
    }
}

// Update stats
function updateStats() {
    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'done').length;
    
    const totalEl = document.querySelector('#stats strong');
    const doneEl = document.querySelector('.done-count');
    if (totalEl) totalEl.textContent = total;
    if (doneEl) doneEl.textContent = done;
    
    Object.keys(columns).forEach(status => {
        const count = tasks.filter(t => t.status === status).length;
        const el = document.getElementById(`count-${status}`);
        if (el) el.textContent = count;
    });
}

// Drag and drop — touch events only
let draggedCard = null;
let dragStartPos = { x: 0, y: 0 };

document.addEventListener('touchstart', (e) => {
    const card = e.target.closest('.task-card');
    if (!card) return;
    
    dragStartPos.x = e.touches[0].clientX;
    dragStartPos.y = e.touches[0].clientY;
    draggedCard = card;
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    if (!draggedCard) return;
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - dragStartPos.x);
    const deltaY = Math.abs(touch.clientY - dragStartPos.y);
    
    if (deltaX > 5 || deltaY > 5) {
        e.preventDefault();
        draggedCard.classList.add('dragging');
        
        const col = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('[data-status]');
        Object.values(columns).forEach(c => c?.classList.remove('drag-over'));
        if (col) col.classList.add('drag-over');
    }
}, { passive: false });

document.addEventListener('touchend', async (e) => {
    if (!draggedCard) return;
    
    const touch = e.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - dragStartPos.x);
    const deltaY = Math.abs(touch.clientY - dragStartPos.y);
    
    if (deltaX < 5 && deltaY < 5) {
        draggedCard.classList.remove('dragging');
        Object.values(columns).forEach(c => c?.classList.remove('drag-over'));
        draggedCard = null;
        return;
    }
    
    draggedCard.classList.remove('dragging');
    const taskId = draggedCard.dataset.id;
    draggedCard = null;
    
    const col = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('[data-status]');
    
    if (col) {
        const newStatus = col.dataset.status;
        const task = tasks.find(t => t.id === taskId);
        
        if (task && task.status !== newStatus) {
            try {
                await fetch(`${API_BASE}/tasks?id=eq.${taskId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': 'sb_publishable_tFOJv36d8OqS9ykGljiZ9g_j94vLO0Z',
                        'Authorization': 'Bearer sb_publishable_tFOJv36d8OqS9ykGljiZ9g_j94vLO0Z',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({ status: newStatus, id: taskId })
                });
                await loadTasks();
                if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
            } catch (err) {
                console.error('Move error:', err);
                if (tg) tg.showPopup({ message: 'Ошибка перемещения', buttons: [{type: 'ok'}] });
            }
        }
    }
    
    Object.values(columns).forEach(c => c?.classList.remove('drag-over'));
});

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('ru-RU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Event listeners with null checks
document.addEventListener('click', (e) => {
    if (e.target.id === 'fab') openEditModal();
});

document.addEventListener('submit', (e) => {
    if (e.target.id === 'taskForm') saveTask(e);
});

document.addEventListener('click', (e) => {
    if (e.target.id === 'closeModal' || e.target.id === 'cancelBtn') closeModal();
});

document.addEventListener('click', (e) => {
    if (e.target.id === 'deleteBtn') deleteTask();
});

document.addEventListener('click', (e) => {
    if (e.target.id === 'taskModal') closeModal();
});

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    loadTasks();
});

// Also try immediately if DOM already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('DOM already ready');
    setTimeout(loadTasks, 100);
}
