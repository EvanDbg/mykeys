/**
 * 后台管理界面 HTML 生成
 */

export function generateAdminHtml(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MyKeys 管理后台</title>
    <style>
        :root {
            --bg: #0f0f1a;
            --surface: #1a1a2e;
            --border: #2a2a4a;
            --primary: #6366f1;
            --primary-hover: #818cf8;
            --danger: #ef4444;
            --success: #22c55e;
            --warning: #f59e0b;
            --text: #e2e8f0;
            --text-muted: #94a3b8;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--border);
        }
        h1 { font-size: 24px; display: flex; align-items: center; gap: 10px; }
        .stats { display: flex; gap: 20px; color: var(--text-muted); font-size: 14px; }
        .toolbar {
            display: flex;
            gap: 12px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
        input[type="search"] {
            flex: 1;
            min-width: 200px;
            padding: 10px 16px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text);
            font-size: 14px;
        }
        input[type="search"]:focus { outline: none; border-color: var(--primary); }
        button {
            padding: 10px 20px;
            background: var(--primary);
            border: none;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.2s;
        }
        button:hover { background: var(--primary-hover); }
        button.danger { background: var(--danger); }
        button.secondary { background: var(--surface); border: 1px solid var(--border); }
        .table-wrap {
            background: var(--surface);
            border-radius: 12px;
            overflow: hidden;
            border: 1px solid var(--border);
        }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 14px 16px; text-align: left; }
        th { background: rgba(99, 102, 241, 0.1); color: var(--text-muted); font-weight: 500; font-size: 13px; }
        tr { border-bottom: 1px solid var(--border); }
        tr:last-child { border-bottom: none; }
        tr:hover td { background: rgba(255,255,255,0.02); }
        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
        }
        .badge-expired { background: rgba(239,68,68,0.2); color: #f87171; }
        .badge-warning { background: rgba(245,158,11,0.2); color: #fbbf24; }
        .badge-ok { background: rgba(34,197,94,0.2); color: #4ade80; }
        .badge-raw { background: rgba(99,102,241,0.2); color: #a5b4fc; }
        .actions { display: flex; gap: 8px; }
        .actions button { padding: 6px 12px; font-size: 13px; }
        .modal {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.7);
            justify-content: center;
            align-items: center;
            z-index: 100;
        }
        .modal.open { display: flex; }
        .modal-content {
            background: var(--surface);
            border-radius: 12px;
            padding: 24px;
            width: 100%;
            max-width: 500px;
            max-height: 90vh;
            overflow-y: auto;
        }
        .modal h2 { margin-bottom: 20px; font-size: 18px; }
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; margin-bottom: 6px; color: var(--text-muted); font-size: 13px; }
        .form-group input, .form-group textarea {
            width: 100%;
            padding: 10px 12px;
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 6px;
            color: var(--text);
            font-size: 14px;
        }
        .form-group textarea { min-height: 100px; resize: vertical; font-family: monospace; }
        .form-group input:focus, .form-group textarea:focus { outline: none; border-color: var(--primary); }
        .form-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px; }
        .toggle-group { display: flex; gap: 8px; margin-bottom: 16px; }
        .toggle-group button { flex: 1; }
        .toggle-group button.active { background: var(--primary); }
        .toggle-group button:not(.active) { background: var(--surface); border: 1px solid var(--border); }
        .password-field { position: relative; }
        .password-field button {
            position: absolute;
            right: 4px;
            top: 50%;
            transform: translateY(-50%);
            padding: 6px 10px;
            background: transparent;
            font-size: 12px;
        }
        .loading { text-align: center; padding: 40px; color: var(--text-muted); }
        .empty { text-align: center; padding: 60px; color: var(--text-muted); }
        @media (max-width: 768px) {
            th:nth-child(3), td:nth-child(3),
            th:nth-child(4), td:nth-child(4) { display: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🔐 MyKeys 管理后台</h1>
            <div class="stats">
                <span id="total-count">加载中...</span>
            </div>
        </header>
        <div class="toolbar">
            <input type="search" id="search" placeholder="搜索名称或网站...">
            <button onclick="openAddModal()">➕ 新增</button>
        </div>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>名称</th>
                        <th>类型</th>
                        <th>账号</th>
                        <th>到期时间</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody id="secrets-list">
                    <tr><td colspan="5" class="loading">加载中...</td></tr>
                </tbody>
            </table>
        </div>
    </div>

    <!-- 新增/编辑弹窗 -->
    <div class="modal" id="edit-modal">
        <div class="modal-content">
            <h2 id="modal-title">新增密码</h2>
            <input type="hidden" id="edit-id">
            <div class="toggle-group" id="type-toggle">
                <button type="button" class="active" onclick="setType('password')">🔑 密码</button>
                <button type="button" onclick="setType('raw')">📄 长文本</button>
            </div>
            <div id="password-fields">
                <div class="form-group">
                    <label>名称 *</label>
                    <input type="text" id="edit-name" placeholder="如：GitHub">
                </div>
                <div class="form-group">
                    <label>网站 *</label>
                    <input type="text" id="edit-site" placeholder="如：github.com">
                </div>
                <div class="form-group">
                    <label>账号 *</label>
                    <input type="text" id="edit-account" placeholder="用户名或邮箱">
                </div>
                <div class="form-group">
                    <label>密码 *</label>
                    <div class="password-field">
                        <input type="password" id="edit-password" placeholder="密码">
                        <button type="button" onclick="togglePassword()">👁</button>
                    </div>
                </div>
                <div class="form-group">
                    <label>备注</label>
                    <input type="text" id="edit-extra" placeholder="可选备注">
                </div>
            </div>
            <div id="raw-fields" style="display:none">
                <div class="form-group">
                    <label>名称 *</label>
                    <input type="text" id="edit-raw-name" placeholder="如：SSH 密钥">
                </div>
                <div class="form-group">
                    <label>内容 *</label>
                    <textarea id="edit-content" placeholder="长文本内容..."></textarea>
                </div>
            </div>
            <div class="form-group">
                <label>到期时间</label>
                <input type="date" id="edit-expires">
            </div>
            <div class="form-actions">
                <button class="secondary" onclick="closeModal()">取消</button>
                <button onclick="saveSecret()">保存</button>
            </div>
        </div>
    </div>

    <!-- 详情弹窗 -->
    <div class="modal" id="detail-modal">
        <div class="modal-content">
            <h2 id="detail-title">密码详情</h2>
            <div id="detail-content"></div>
            <div class="form-actions">
                <button class="secondary" onclick="closeDetailModal()">关闭</button>
                <button onclick="editFromDetail()">编辑</button>
            </div>
        </div>
    </div>

    <script>
        let secrets = [];
        let currentType = 'password';
        let currentDetailId = null;

        async function api(path, options = {}) {
            const res = await fetch('/admin' + path, {
                ...options,
                headers: { 'Content-Type': 'application/json', ...options.headers }
            });
            return res.json();
        }

        async function loadSecrets() {
            const result = await api('/api/secrets');
            if (result.success) {
                secrets = result.data;
                renderTable();
                document.getElementById('total-count').textContent = '共 ' + secrets.length + ' 条';
            }
        }

        function renderTable() {
            const search = document.getElementById('search').value.toLowerCase();
            const filtered = secrets.filter(s => 
                s.name.toLowerCase().includes(search) || 
                (s.site && s.site.toLowerCase().includes(search))
            );

            const tbody = document.getElementById('secrets-list');
            if (filtered.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="empty">暂无数据</td></tr>';
                return;
            }

            tbody.innerHTML = filtered.map(s => {
                const isRaw = s.site === 'raw';
                let expiryBadge = '';
                if (s.expires_at) {
                    const days = Math.ceil((new Date(s.expires_at) - Date.now()) / 864e5);
                    if (days <= 0) expiryBadge = '<span class="badge badge-expired">已过期</span>';
                    else if (days <= 7) expiryBadge = '<span class="badge badge-warning">' + days + '天</span>';
                    else expiryBadge = '<span class="badge badge-ok">' + s.expires_at + '</span>';
                } else {
                    expiryBadge = '<span style="color:var(--text-muted)">-</span>';
                }

                return '<tr>' +
                    '<td><strong>' + escapeHtml(s.name) + '</strong></td>' +
                    '<td>' + (isRaw ? '<span class="badge badge-raw">长文本</span>' : escapeHtml(s.site)) + '</td>' +
                    '<td>' + (isRaw ? '-' : '******') + '</td>' +
                    '<td>' + expiryBadge + '</td>' +
                    '<td class="actions">' +
                        '<button class="secondary" onclick="viewDetail(' + s.id + ')">查看</button>' +
                        '<button class="secondary" onclick="editSecret(' + s.id + ')">编辑</button>' +
                        '<button class="danger" onclick="deleteSecret(' + s.id + ')">删除</button>' +
                    '</td>' +
                '</tr>';
            }).join('');
        }

        function escapeHtml(str) {
            if (!str) return '';
            return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        async function viewDetail(id) {
            const result = await api('/api/secrets/' + id);
            if (!result.success) return alert(result.error);

            const d = result.data;
            currentDetailId = id;
            document.getElementById('detail-title').textContent = d.name;

            let html = '';
            if (d.isRaw) {
                html = '<div class="form-group"><label>内容</label><textarea readonly style="background:var(--bg)">' + 
                    escapeHtml(d.password) + '</textarea></div>';
            } else {
                html = '<div class="form-group"><label>网站</label><input readonly value="' + escapeHtml(d.site) + '"></div>' +
                    '<div class="form-group"><label>账号</label><input readonly value="' + escapeHtml(d.account) + '"></div>' +
                    '<div class="form-group"><label>密码</label><input readonly value="' + escapeHtml(d.password) + '"></div>' +
                    (d.extra ? '<div class="form-group"><label>备注</label><input readonly value="' + escapeHtml(d.extra) + '"></div>' : '');
            }
            if (d.expiresAt) {
                html += '<div class="form-group"><label>到期时间</label><input readonly value="' + d.expiresAt + ' ' + d.expiryInfo + '"></div>';
            }

            document.getElementById('detail-content').innerHTML = html;
            document.getElementById('detail-modal').classList.add('open');
        }

        function closeDetailModal() {
            document.getElementById('detail-modal').classList.remove('open');
            currentDetailId = null;
        }

        function editFromDetail() {
            closeDetailModal();
            if (currentDetailId) editSecret(currentDetailId);
        }

        function openAddModal() {
            document.getElementById('edit-id').value = '';
            document.getElementById('modal-title').textContent = '新增密码';
            document.getElementById('edit-name').value = '';
            document.getElementById('edit-site').value = '';
            document.getElementById('edit-account').value = '';
            document.getElementById('edit-password').value = '';
            document.getElementById('edit-extra').value = '';
            document.getElementById('edit-raw-name').value = '';
            document.getElementById('edit-content').value = '';
            document.getElementById('edit-expires').value = '';
            setType('password');
            document.getElementById('edit-modal').classList.add('open');
        }

        async function editSecret(id) {
            const result = await api('/api/secrets/' + id);
            if (!result.success) return alert(result.error);

            const d = result.data;
            document.getElementById('edit-id').value = id;
            document.getElementById('modal-title').textContent = '编辑密码';

            if (d.isRaw) {
                setType('raw');
                document.getElementById('edit-raw-name').value = d.name;
                document.getElementById('edit-content').value = d.password;
            } else {
                setType('password');
                document.getElementById('edit-name').value = d.name;
                document.getElementById('edit-site').value = d.site;
                document.getElementById('edit-account').value = d.account || '';
                document.getElementById('edit-password').value = d.password;
                document.getElementById('edit-extra').value = d.extra || '';
            }
            document.getElementById('edit-expires').value = d.expiresAt || '';
            document.getElementById('edit-modal').classList.add('open');
        }

        function setType(type) {
            currentType = type;
            const btns = document.querySelectorAll('#type-toggle button');
            btns[0].classList.toggle('active', type === 'password');
            btns[1].classList.toggle('active', type === 'raw');
            document.getElementById('password-fields').style.display = type === 'password' ? 'block' : 'none';
            document.getElementById('raw-fields').style.display = type === 'raw' ? 'block' : 'none';
        }

        function togglePassword() {
            const inp = document.getElementById('edit-password');
            inp.type = inp.type === 'password' ? 'text' : 'password';
        }

        function closeModal() {
            document.getElementById('edit-modal').classList.remove('open');
        }

        async function saveSecret() {
            const id = document.getElementById('edit-id').value;
            const expires = document.getElementById('edit-expires').value;

            let body;
            if (currentType === 'raw') {
                body = {
                    name: document.getElementById('edit-raw-name').value,
                    isRaw: true,
                    content: document.getElementById('edit-content').value,
                    expiresAt: expires || null
                };
            } else {
                body = {
                    name: document.getElementById('edit-name').value,
                    site: document.getElementById('edit-site').value,
                    account: document.getElementById('edit-account').value,
                    password: document.getElementById('edit-password').value,
                    extra: document.getElementById('edit-extra').value || null,
                    expiresAt: expires || null
                };
            }

            const result = id 
                ? await api('/api/secrets/' + id, { method: 'PUT', body: JSON.stringify(body) })
                : await api('/api/secrets', { method: 'POST', body: JSON.stringify(body) });

            if (result.success) {
                closeModal();
                loadSecrets();
            } else {
                alert(result.error);
            }
        }

        async function deleteSecret(id) {
            if (!confirm('确定要删除这条记录吗？')) return;
            const result = await api('/api/secrets/' + id, { method: 'DELETE' });
            if (result.success) {
                loadSecrets();
            } else {
                alert(result.error);
            }
        }

        document.getElementById('search').addEventListener('input', renderTable);
        loadSecrets();
    </script>
</body>
</html>`;
}
