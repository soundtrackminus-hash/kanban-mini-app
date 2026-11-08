// Telegram Mini App - Kanban Board
let tg = window.Telegram.WebApp;
tg.expand();
tg.setHeaderColor('#1a1a2e');

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

// Load tasks
async function loadTasks() {
    try {
        const res = await fetch(`${API_BASE}/tasks`, {
            headers: {
                'apikey': 'sb_publishable_tFOJv36d8OqS9ykGljiZ9g_j94vLO0Z',
                'Authorization': 'Bearer sb_publishable_tFOJv36d8OqS9ykGljiZ9g_j94vLO0Z'
            }
        });
        tasks = await res.json();
        renderBoard();
    } catch (e) {
        console.error('Load failed:', e);
        tg.showPopup({ message: 'Ошибка загрузки задач' });
    }
}

// Render board
function renderBoard() {
    // Clear all columns
    Object.values(columns).forEach(col => col.innerHTML = '');
    
    // Sort by priority then created
    const sorted = [...tasks].sort((a, b) => b.priority - a.priority);
    
    sorted.forEach(task => {
        const card = createCard(task);
        if (columns[task.status]) {
            columns[task.status].appendChild(card);
        }
    });
    
    updateStats();
}

// Create card element
function createCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.dataset.id = task.id;
    
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
    
    card.onclick = () => openEditModal(task);
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
        tg.showPopup({ message: 'Введите название задачи' });
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
            // Update existing
            await fetch(`${API_BASE}/tasks?id=eq.${editingTask.id}`, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify({ id: editingTask.id, title, body, status, assignee, priority })
            });
        } else {
            // Create new - generate UUID for id
            const newId = 't_' + Math.random().toString(36).substr(2, 9);
            await fetch(`${API_BASE}/tasks`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ id: newId, title, body, status, assignee, priority })
            });
        }
        
        closeModal();
        await loadTasks();
        tg.HapticFeedback.impactOccurred('light');
    } catch (e) {
        tg.showPopup({ message: 'Ошибка сохранения' });
    }
}

// Delete task
async function deleteTask() {
    if (!editingTask) return;
    
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
        tg.HapticFeedback.notificationOccurred('success');
    } catch (e) {
        tg.showPopup({ message: 'Ошибка удаления' });
    }
}

// Update stats
function updateStats() {
    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'done').length;
    
    document.querySelector('#stats strong').textContent = total;
    document.querySelector('.done-count').textContent = done;
    
    // Update column counts
    Object.keys(columns).forEach(status => {
        const count = tasks.filter(t => t.status === status).length;
        document.getElementById(`count-${status}`).textContent = count;
    });
}

// Drag and drop — делегирование через document, слушатели только один раз
let draggedCard = null;
let touchStartY = 0;

document.addEventListener('mousedown', (e) => {
    const card = e.target.closest('.task-card');
    if (!card) return;
    draggedCard = card;
    card.classList.add('dragging');
});

document.addEventListener('mousemove', (e) => {
    if (!draggedCard) return;
    // Проверяем, что мышь над колонкой
    const col = e.target.closest('[data-status]');
    if (col) {
        Object.values(columns).forEach(c => c.classList.remove('drag-over'));
        col.classList.add('drag-over');
    } else {
        Object.values(columns).forEach(c => c.classList.remove('drag-over'));
    }
});

document.addEventListener('mouseup', async (e) => {
    if (!draggedCard) return;
    draggedCard.classList.remove('dragging');
    
    const taskId = draggedCard.dataset.id;
    const col = e.target.closest('[data-status]');
    
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
                tg.HapticFeedback.impactOccurred('medium');
            } catch (err) {
                tg.showPopup({ message: 'Ошибка перемещения' });
            }
        }
    }
    
    Object.values(columns).forEach(c => c.classList.remove('drag-over'));
    draggedCard = null;
});

// Touch support for mobile
document.addEventListener('touchstart', (e) => {
    const card = e.target.closest('.task-card');
    if (!card) return;
    draggedCard = card;
    touchStartY = e.touches[0].clientY;
    setTimeout(() => {
        if (draggedCard) draggedCard.classList.add('dragging');
    }, 200);
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    if (!draggedCard) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const col = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('[data-status]');
    
    Object.values(columns).forEach(c => c.classList.remove('drag-over'));
    if (col) col.classList.add('drag-over');
}, { passive: false });

document.addEventListener('touchend', async (e) => {
    if (!draggedCard) return;
    draggedCard.classList.remove('dragging');
    
    const touch = e.changedTouches[0];
    const col = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('[data-status]');
    const taskId = draggedCard.dataset.id;
    
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
                tg.HapticFeedback.impactOccurred('medium');
            } catch (err) {
                tg.showPopup({ message: 'Ошибка перемещения' });
            }
        }
    }
    
    Object.values(columns).forEach(c => c.classList.remove('drag-over'));
    draggedCard = null;
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

// FAB button
document.getElementById('fab').onclick = () => openEditModal();

// Form handlers
document.getElementById('taskForm').onsubmit = saveTask;
document.getElementById('closeModal').onclick = closeModal;
document.getElementById('cancelBtn').onclick = closeModal;
document.getElementById('deleteBtn').onclick = deleteTask;

// Close modal on outside click
document.getElementById('taskModal').onclick = (e) => {
    if (e.target.id === 'taskModal') closeModal();
};

// Initialize
loadTasks();
