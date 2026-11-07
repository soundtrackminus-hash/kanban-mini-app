#!/usr/bin/env python3
"""
API для доступа к Kanban базе данных
"""
import sqlite3
import json
import time
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse
from datetime import datetime

DB_PATH = Path.home() / ".hermes/kanban.db"
def normalize_task(task_dict):
    """Normalize task data for the mini-app client."""
    normalized = dict(task_dict)

    # Normalize priority
    if 'priority' in normalized:
        p = normalized['priority']
        if isinstance(p, str):
            priority_map = {
                'low': 1, 'низкий': 1,
                'medium': 2, 'средний': 2,
                'high': 3, 'высокий': 3,
                'critical': 4, 'критический': 4,
            }
            normalized['priority'] = priority_map.get(p.lower(), 0)
        elif isinstance(p, (int, float)):
            normalized['priority'] = int(p)
        else:
            normalized['priority'] = 0

    # Normalize created_at to unix timestamp
    if 'created_at' in normalized:
        cat = normalized['created_at']
        if isinstance(cat, str):
            try:
                dt = datetime.fromisoformat(cat.replace('Z', '+00:00'))
                normalized['created_at'] = int(dt.timestamp())
            except:
                normalized['created_at'] = 0
        elif isinstance(cat, (int, float)):
            normalized['created_at'] = int(cat)
        else:
            normalized['created_at'] = 0

    # Normalize other timestamps
    for field in ['started_at', 'completed_at']:
        if field in normalized and normalized[field]:
            val = normalized[field]
            if isinstance(val, str):
                try:
                    dt = datetime.fromisoformat(val.replace('Z', '+00:00'))
                    normalized[field] = int(dt.timestamp())
                except:
                    normalized[field] = 0
            elif isinstance(val, (int, float)):
                normalized[field] = int(val)

    return normalized
class KanbanAPIHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_GET(self):
        """Получение задач"""
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        if parsed.path == '/api/tasks':
            tasks = self.get_tasks(params)
            tasks = [normalize_task(t) for t in tasks]
            self.send_json(tasks)
        elif parsed.path == '/api/tasks-data':
            tasks = self.get_tasks(params)
            tasks = [normalize_task(t) for t in tasks]
            self.send_json(tasks)
        elif parsed.path == '/api/stats':
            stats = self.get_stats()
            self.send_json(stats)
        elif parsed.path.startswith('/api/tasks/') and '/check-points' in parsed.path:
            task_id = parsed.path.split('/api/tasks/')[1].split('/check-points')[0]
            cps = self.get_check_points(task_id)
            self.send_json(cps)
        elif parsed.path.startswith('/api/check-points/'):
            cp_id = parsed.path.split('/')[-1]
            cp = self.get_check_point(cp_id)
            self.send_json(cp)
        else:
            self.send_error(404)

    def do_POST(self):
        """Создание/обновление задач"""
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == '/api/tasks':
            task = self.create_task()
            task = normalize_task(task)
            self.send_json(task, 201)
        elif parsed.path.startswith('/api/tasks/'):
            task = self.update_task()
            task = normalize_task(task)
            self.send_json(task)
        elif parsed.path.startswith('/api/tasks/') and parsed.path.endswith('/check-points'):
            task_id = parsed.path.split('/api/tasks/')[1].split('/check-points')[0]
            data = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            cp = self.create_check_point(task_id, data.get('label', 'Чек-поинт'), data.get('completed_by', 'miniapp'))
            self.send_json(cp, 201)
        elif parsed.path.startswith('/api/check-points/'):
            cp_id = parsed.path.split('/')[-1]
            cp = self.get_check_point(cp_id)
            self.send_json(cp)
        else:
            self.send_error(404)

    def do_PUT(self):
        """Update task (for drag-drop)"""
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.startswith('/api/tasks/'):
            task = self.update_task()
            task = normalize_task(task)
            self.send_json(task)
        elif parsed.path.startswith('/api/tasks/') and parsed.path.endswith('/check-points'):
            task_id = parsed.path.split('/')[-2]
            data = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            cp_label = data.get('label', '')
            completed_by = data.get('completed_by', 'miniapp')
            result = self.complete_check_point(task_id, cp_label, completed_by)
            self.send_json(result)
        else:
            self.send_error(404)

    def do_DELETE(self):
        """Удаление задачи"""
        task_id = self.get_task_id()
        if task_id:
            self.delete_task(task_id)
            self.send_json({'success': True, 'id': task_id})
        else:
            self.send_error(400)

    def get_tasks(self, params=None):
        """Получение списка задач"""
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Фильтры
        status = params.get('status', [None])[0] if params else None
        assignee = params.get('assignee', [None])[0] if params else None

        query = "SELECT * FROM tasks WHERE 1=1"
        if status:
            query += f" AND status = '{status}'"
        if assignee:
            query += f" AND assignee LIKE '%{assignee}%'"
        query += " ORDER BY created_at DESC"

        cursor.execute(query)
        tasks = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return tasks

    def get_stats(self):
        """Статистика по задачам"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        stats = {}
        for status in ['todo', 'in_progress', 'done', 'blocked', 'canceled']:
            cursor.execute("SELECT COUNT(*) FROM tasks WHERE status = ?", (status,))
            stats[status] = cursor.fetchone()[0]

        stats['total'] = sum(stats.values())
        conn.close()
        return stats

    def create_task(self):
        """Создание новой задачи"""
        data = json.loads(self.rfile.read(int(self.headers['Content-Length'])))

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Генерация ID
        import hashlib
        import time
        task_id = f"t_{hashlib.md5(str(time.time()).encode()).hexdigest()[:8]}"

        cursor.execute("""
            INSERT INTO tasks (id, title, body, status, priority, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            task_id,
            data.get('title', ''),
            data.get('body', ''),
            data.get('status', 'todo'),
            data.get('priority', 0),
            data.get('created_by', 'miniapp'),
            int(time.time())
        ))

        conn.commit()
        conn.close()
        return {'id': task_id, 'title': data.get('title')}

    def update_task(self):
        """Обновление задачи"""
        task_id = self.get_task_id()
        data = json.loads(self.rfile.read(int(self.headers['Content-Length'])))

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        fields = []
        values = []

        if 'title' in data:
            fields.append("title = ?")
            values.append(data['title'])
        if 'body' in data:
            fields.append("body = ?")
            values.append(data['body'])
        if 'status' in data:
            fields.append("status = ?")
            values.append(data['status'])
        if 'assignee' in data:
            fields.append("assignee = ?")
            values.append(data['assignee'])
        if 'priority' in data:
            fields.append("priority = ?")
            values.append(data['priority'])

        if fields:
            values.append(task_id)
            cursor.execute(f"UPDATE tasks SET {', '.join(fields)} WHERE id = ?", values)
            conn.commit()

        conn.close()
        return {'id': task_id, 'updated': True}

    def delete_task(self, task_id):
        """Удаление задачи"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        conn.commit()
        conn.close()

    def get_task_id(self):
        """Извлечение ID задачи из URL"""
        parsed = urllib.parse.urlparse(self.path)
        parts = parsed.path.strip('/').split('/')
        return parts[-1] if len(parts) > 2 else None

    def get_check_points(self, task_id):
        """Получить все чек-поинты для задачи"""
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM check_points WHERE task_id = ? ORDER BY created_at ASC", (task_id,))
        check_points = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return check_points

    def get_check_point(self, cp_id):
        """Получить чек-поинт по ID"""
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM check_points WHERE id = ?", (cp_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None

    def create_check_point(self, task_id, label, completed_by='miniapp'):
        """Создать новый чек-поинт"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        created_at = int(time.time())
        cursor.execute(
            "INSERT INTO check_points (task_id, label, created_at, completed_by) VALUES (?, ?, ?, ?)",
            (task_id, label, created_at, completed_by)
        )
        conn.commit()
        cp_id = cursor.lastrowid
        conn.close()
        return {'id': cp_id, 'task_id': task_id, 'label': label}

    def complete_check_point(self, task_id, cp_label, completed_by='miniapp'):
        """Отметить чек-поинт как выполненный"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        completed_at = int(time.time())
        cursor.execute(
            "UPDATE check_points SET completed_at = ?, completed_by = ? WHERE task_id = ? AND label = ? AND completed_at IS NULL",
            (completed_at, completed_by, task_id, cp_label)
        )
        conn.commit()
        cursor.execute("SELECT COUNT(*) FROM check_points WHERE task_id = ?", (task_id,))
        total = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM check_points WHERE task_id = ? AND completed_at IS NOT NULL", (task_id,))
        completed = cursor.fetchone()[0]
        conn.close()
        return {'total': total, 'completed': completed, 'completion_pct': round(completed / total * 100, 1) if total > 0 else 0}

    def send_json(self, data, status=200):
        """Отправка JSON ответа"""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())

    def log_message(self, format, *args):
        """Логирование"""
        pass  # Отключаем лог для чистоты вывода
def run_server(port=8766):
    server = HTTPServer(('0.0.0.0', port), KanbanAPIHandler)
    print(f"Kanban API запущен на порту {port}")
    server.serve_forever()
if __name__ == '__main__':
    run_server()