// functions/admin/index.js
// GET /admin — serves the admin SPA panel HTML
// Body is a separate static file inlined here to avoid static-asset plumbing.

const HTML = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>nim-rotator · admin</title>
<style>
  :root {
    --bg: #0f1115; --panel: #1a1d23; --panel-2: #232830; --line: #2c313a;
    --text: #e6e9ed; --muted: #8a93a3; --accent: #7cb6ff; --ok: #5fd17a;
    --warn: #f1b45a; --err: #ff6f6f; --cool: #8e7ad6;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, "SF Pro", "Inter", "Segoe UI", sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; }
  header { padding: 14px 24px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; background: var(--panel); }
  header h1 { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: 0.4px; }
  header .meta { color: var(--muted); font-size: 12px; }
  main { padding: 20px 24px; max-width: 1100px; margin: 0 auto; }
  section { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 18px 20px; margin-bottom: 18px; }
  section h2 { margin: 0 0 14px; font-size: 14px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; }
  button { background: var(--panel-2); border: 1px solid var(--line); color: var(--text); padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; transition: background 0.15s; }
  button:hover { background: #2d333c; }
  button.primary { background: var(--accent); color: #00121f; border-color: var(--accent); font-weight: 500; }
  button.primary:hover { background: #5da4f5; }
  button.danger { color: var(--err); }
  button.danger:hover { background: #3a2222; }
  button.warn { color: var(--warn); }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
  input[type=text], input[type=password] { background: var(--bg); border: 1px solid var(--line); color: var(--text); padding: 7px 10px; border-radius: 4px; font-size: 13px; width: 360px; max-width: 100%; }
  input:focus { outline: none; border-color: var(--accent); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; color: var(--muted); font-weight: 500; padding: 8px 10px; border-bottom: 1px solid var(--line); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 10px; border-bottom: 1px solid var(--line); }
  tr:last-child td { border-bottom: none; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; letter-spacing: 0.4px; }
  .pill.ok { background: rgba(95, 209, 122, 0.15); color: var(--ok); }
  .pill.cool { background: rgba(142, 122, 214, 0.15); color: var(--cool); }
  .pill.off { background: rgba(138, 147, 163, 0.15); color: var(--muted); }
  .pill.err { background: rgba(255, 111, 111, 0.15); color: var(--err); }
  .row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .row.gap { gap: 16px; }
  .muted { color: var(--muted); }
  .small { font-size: 11px; }
  .num { font-variant-numeric: tabular-nums; }
  .login-wrap { max-width: 380px; margin: 80px auto; padding: 32px; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; }
  .login-wrap h1 { margin: 0 0 6px; font-size: 18px; }
  .login-wrap p { margin: 0 0 24px; color: var(--muted); font-size: 13px; }
  .login-wrap input { width: 100%; margin-bottom: 12px; }
  .login-wrap button { width: 100%; padding: 10px; }
  .err-msg { color: var(--err); font-size: 12px; margin-bottom: 8px; min-height: 14px; }
  .ok-msg { color: var(--ok); font-size: 12px; margin-bottom: 8px; min-height: 14px; }
  code { background: var(--bg); padding: 1px 6px; border-radius: 3px; font-size: 12px; color: var(--accent); }
  .stat-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-top: 8px; }
  .stat-card { padding: 10px; background: var(--panel-2); border-radius: 6px; text-align: center; }
  .stat-card .v { font-size: 22px; font-weight: 600; }
  .stat-card .l { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
  .bar { height: 4px; background: var(--line); border-radius: 2px; overflow: hidden; margin-top: 6px; }
  .bar > span { display: block; height: 100%; background: var(--accent); }
  .inline-form { display: flex; gap: 8px; align-items: flex-start; flex-wrap: wrap; }
  .inline-form > div { display: flex; flex-direction: column; gap: 4px; }
  .inline-form label { font-size: 11px; color: var(--muted); }
  .input-lg { width: 460px !important; }
  /* logs table */
  .log-row.ok { color: var(--ok); }
  .log-row.err { color: var(--err); }
  .log-row.warn { color: var(--warn); }
  .log-row.muted { color: var(--muted); }
  .log-table { font-size: 12px; }
  .log-table td { padding: 6px 10px; }
  .log-table .err-cell { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .log-empty { padding: 20px; text-align: center; color: var(--muted); font-size: 13px; }
</style>
</head>
<body>
<header>
  <h1>nim-rotator · admin</h1>
  <div id="topMeta" class="meta"></div>
</header>

<div id="app"></div>

<script>
const API = '/admin/api';

const state = {
  keys: [],
  stats: null,
  // form
  newId: '',
  newValue: '',
  newNote: '',
};

// ---------- API client ----------
async function jget(path) {
  const r = await fetch(API + path, { credentials: 'same-origin' });
  if (!r.ok) throw ({ status: r.status, text: await r.text() });
  return r.json();
}
async function jpost(path, body) {
  const r = await fetch(API + path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw ({ status: r.status, text: await r.text() });
  return r.json();
}
async function jput(path, body) {
  const r = await fetch(API + path, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw ({ status: r.status, text: await r.text() });
  return r.json();
}
async function jdelete(path) {
  const r = await fetch(API + path, {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  if (!r.ok) throw ({ status: r.status, text: await r.text() });
  return r.json();
}

// ---------- views ----------
function viewLogin(err) {
  document.getElementById('app').innerHTML = \`
    <div class="login-wrap">
      <h1>登录</h1>
      <p>nim-rotator 管理面板</p>
      <div class="\${err ? 'err-msg' : 'ok-msg'}">\${err || ''}</div>
      <form id="loginForm">
        <input id="pwd" type="password" placeholder="密码" autocomplete="current-password" autofocus>
        <button class="primary" type="submit">进入</button>
      </form>
    </div>
  \`;
  document.getElementById('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const password = document.getElementById('pwd').value;
    try {
      const r = await fetch(API + '/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (r.status === 200) { viewApp(); return; }
      const t = await r.text();
      viewLogin(t || '登录失败');
    } catch (e) { viewLogin(String(e)); }
  };
}

function fmtMs(ms) {
  if (!ms || ms < 0) return '0s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm' + (s % 60) + 's';
  const h = Math.floor(m / 60);
  return h + 'h' + (m % 60) + 'm';
}

function pStatus(k) {
  if (k.active === false) return '<span class="pill off">disabled</span>';
  if (k.cooldown) return '<span class="pill cool">cooldown</span>';
  return '<span class="pill ok">active</span>';
}

async function viewApp() {
  document.getElementById('app').innerHTML = \`
    <main>
      <section>
        <div class="row" style="justify-content:space-between;">
          <h2>key 管理</h2>
          <div class="row">
            <button id="refreshBtn">刷新</button>
            <button class="primary" id="addBtn">添加新 key</button>
            <button class="warn" id="logoutBtn">退出</button>
          </div>
        </div>
        <div id="keysBox"></div>
      </section>

      <section>
        <h2>7 日 统计</h2>
        <div id="statsBox">loading...</div>
      </section>

      <section>
        <div class="row" style="justify-content:space-between;">
          <h2>调用记录</h2>
          <button id="refreshLogsBtn">刷新</button>
        </div>
        <div id="logsBox">loading...</div>
      </section>

      <section>
        <h2>每日 添加 shape</h2>
        <div class="muted small">
          输入 <code>key:1</code> 形式 当不输入 ID 会让系统生成。点击 <code>添加</code> 后是新行可被验。点击 <code>验证</code> 可能需要 1-3 秒
        </div>
      </section>
    </main>
  \`;

  document.getElementById('refreshBtn').onclick = () => loadKeys();
  document.getElementById('refreshLogsBtn').onclick = () => loadLogs();
  document.getElementById('logoutBtn').onclick = () => logout();
  document.getElementById('addBtn').onclick = () => focusAdd();

  await loadKeys();
  await loadStats();
  await loadLogs();
}

async function logout() {
  await jpost('/logout', {});
  viewLogin();
}

async function focusAdd() {
  const inp = document.getElementById('newValue');
  inp && inp.focus();
}

async function loadKeys() {
  const box = document.getElementById('keysBox');
  if (!box) return;
  box.innerHTML = 'loading...';
  try {
    const r = await jget('/keys');
    state.keys = r.keys;

    let rows = r.keys.map(k => \`
      <tr>
        <td><code>\${k.id}</code></td>
        <td>\${k.value ? '<code class="small muted">' + k.id + '</code>' : '<code>' + k.value_masked + '</code>'}</td>
        <td>\${pStatus(k)}</td>
        <td class="muted">\${k.cooldown ? fmtMs(k.cooldownRemainMs) : '—'}</td>
        <td class="muted small">\${k.lastFailStatus ? k.lastFailStatus + ' · ' + new Date(k.lastFailAt).toLocaleTimeString() : '—'}</td>
        <td class="muted small">\${k.note ? '·' + k.note.slice(0,40) + (k.note.length>40?'…':'') : '—'}</td>
        <td>
          <div class="row">
            <button data-test="\${k.id}">验证</button>
            <button data-toggle="\${k.id}">\${k.active===false ? '启用' : '禁用'}</button>
            <button data-clear="\${k.id}">清 cooldown</button>
            <button class="danger" data-del="\${k.id}">删</button>
          </div>
        </td>
      </tr>
    \`).join('');

    rows += \`
      <tr style="background: rgba(124,182,255,0.04);">
        <td><input id="newId" type="text" placeholder="ID 可选 · 如 key:1"></td>
        <td colspan="3"><input id="newValue" class="input-lg" type="text" placeholder="nvapi-..."></td>
        <td><input id="newNote" type="text" placeholder="备注"></td>
        <td colspan="2">
          <div class="row">
            <button class="primary" id="saveAdd">保存</button>
          </div>
        </td>
      </tr>
    \`;

    box.innerHTML = \`
      <table>
        <thead>
          <tr><th>ID</th><th>value</th><th>状态</th><th>cooldown</th><th>lastfail</th><th>note</th><th>action</th></tr>
        </thead>
        <tbody>\${rows}</tbody>
      </table>
    \`;

    // bind actions
    box.querySelectorAll('[data-test]').forEach(b => b.onclick = () => testKey(b.dataset.test));
    box.querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => toggleKey(b.dataset.toggle));
    box.querySelectorAll('[data-clear]').forEach(b => b.onclick = () => clearCool(b.dataset.clear));
    box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => delKey(b.dataset.del));
    document.getElementById('saveAdd').onclick = saveAdd;

    // top meta
    const active = r.keys.filter(k => k.active !== false && !k.cooldown).length;
    const cool = r.keys.filter(k => k.cooldown).length;
    const off = r.keys.filter(k => k.active === false).length;
    document.getElementById('topMeta').textContent = \`活跃 \${active} · cooldown \${cool} · disabled \${off} · 总 \${r.keys.length}\`;
  } catch (e) {
    if (e && e.status === 401) { viewLogin('session expired'); return; }
    box.innerHTML = '<span class="err-msg">加载失败 · ' + JSON.stringify(e).slice(0,200) + '</span>';
  }
}

async function loadStats() {
  const box = document.getElementById('statsBox');
  if (!box) return;
  try {
    const r = await jget('/stats');
    state.stats = r;
    const max = Math.max(1, ...r.series.map(d => d.total || 0));
    box.innerHTML = \`
      <div class="stat-grid">
        \${r.series.slice().reverse().map(d => \`
          <div class="stat-card">
            <div class="v num">\${d.total || 0}</div>
            <div class="l">\${d.day.slice(5)}</div>
            <div class="bar" title="\${d.ok||0} ok · \${d.fail||0} fail"><span style="width:\${Math.round((d.total/max)*100)}%"></span></div>
          </div>
        \`).join('')}
      </div>
      \${r.series[0].total === 0 ? '<div class="muted small" style="margin-top:14px;">没有请求数据。聊天请求发一些后会看到统计。</div>' : ''}
      <div style="margin-top:10px;" class="muted small">今天 · \${r.today}</div>
    \`;
  } catch (e) {
    box.innerHTML = '<span class="err-msg">统计加载失败 · ' + JSON.stringify(e).slice(0,200) + '</span>';
  }
}

async function loadLogs() {
  const box = document.getElementById('logsBox');
  if (!box) return;
  try {
    const r = await jget('/stats?logs=50');
    const logs = r.logs || [];
    if (logs.length === 0) {
      box.innerHTML = '<div class="log-empty">还没有调用记录。发几个请求后刷新就能看到。</div>';
      return;
    }
    const rows = logs.map((l) => {
      const isOk = l.status >= 200 && l.status < 300;
      const cls = isOk ? 'ok' : (l.status >= 500 ? 'err' : (l.status >= 400 ? 'warn' : 'muted'));
      const statusPill = isOk
        ? '<span class="pill ok">' + l.status + '</span>'
        : l.status >= 500
          ? '<span class="pill err">' + l.status + '</span>'
          : '<span class="pill cool">' + l.status + '</span>';
      const errCell = l.error ? '<code class="small err-cell" title="' + l.error.replace(/"/g,'') + '">' + l.error.slice(0,60) + (l.error.length > 60 ? '…' : '') + '</code>' : '<span class="muted">—</span>';
      const keyShort = (l.keyUsed || '').replace(/^key:/, '');
      return \`
        <tr class="log-row \${cls}">
          <td class="muted small">\${l.tsFmt || ''}</td>
          <td><code class="small">\${(l.model || '').slice(0,40)}</code></td>
          <td>\${statusPill}</td>
          <td class="small">\${keyShort || '—'}</td>
          <td class="num small">\${l.keysTried || 0}</td>
          <td class="num small">\${l.latencyMs || 0}ms</td>
          <td>\${errCell}</td>
        </tr>
      \`;
    }).join('');
    box.innerHTML = \`
      <table class="log-table">
        <thead>
          <tr>
            <th>时间 (UTC)</th>
            <th>模型</th>
            <th>状态</th>
            <th>用 key</th>
            <th>试了几把</th>
            <th>耗时</th>
            <th>错误</th>
          </tr>
        </thead>
        <tbody>\${rows}</tbody>
      </table>
      <div class="muted small" style="margin-top:8px;">显示最近 \${logs.length} 条 · 最多保留 100 条</div>
    \`;
  } catch (e) {
    if (e && e.status === 401) { viewLogin('session expired'); return; }
    box.innerHTML = '<span class="err-msg">日志加载失败 · ' + JSON.stringify(e).slice(0,200) + '</span>';
  }
}

async function saveAdd() {
  const id = document.getElementById('newId').value.trim();
  const value = document.getElementById('newValue').value.trim();
  const note = document.getElementById('newNote').value.trim();
  if (!value) return alert('value 不能空');
  try {
    await jpost('/keys', id ? { id, value, note } : { value, note });
    document.getElementById('newId').value = '';
    document.getElementById('newValue').value = '';
    document.getElementById('newNote').value = '';
    await loadKeys();
  } catch (e) { alert('保存失败 · ' + JSON.stringify(e).slice(0,200)); }
}

async function toggleKey(id) {
  try { await jpost('/keys?action=toggle', { id }); await loadKeys(); }
  catch (e) { alert('失败 · ' + JSON.stringify(e).slice(0,200)); }
}
async function clearCool(id) {
  try { await jpost('/keys?action=clear-cooldown', { id }); await loadKeys(); }
  catch (e) { alert('失败 · ' + JSON.stringify(e).slice(0,200)); }
}
async function delKey(id) {
  if (!confirm('确定删 ' + id + ' ?')) return;
  try { await jdelete('/keys?id=' + encodeURIComponent(id)); await loadKeys(); }
  catch (e) { alert('失败 · ' + JSON.stringify(e).slice(0,200)); }
}
async function testKey(id) {
  // 把 button 文字换成 testing...
  const btn = [...document.querySelectorAll('[data-test]')].find(b => b.dataset.test === id);
  if (btn) { btn.disabled = true; btn.textContent = '验证中...'; }
  try {
    const r = await jpost('/test', { id });
    const msg = r.ok
      ? 'OK · ' + r.latencyMs + 'ms · ' + (r.models||'?') + ' 模型'
      : '失败 · status ' + (r.status || 'unknown') + ' · ' + (r.error || '').slice(0,80);
    if (r.ok) alert('✓ ' + id + '\\n' + msg);
    else   alert('✗ ' + id + '\\n' + msg);
    await loadKeys(); // refresh cooldown etc
  } catch (e) {
    alert('请求失败 · ' + JSON.stringify(e).slice(0,200));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '验证'; }
  }
}

// ---------- boot ----------
(async function () {
  // try GET /keys to see if cookie works
  try {
    const r = await fetch(API + '/keys', { credentials: 'same-origin' });
    if (r.status === 200) { viewApp(); return; }
    if (r.status === 401) { viewLogin(); return; }
  } catch (e) { viewLogin(String(e)); return; }
  viewLogin();
})();
</script>
</body>
</html>`;

export async function onRequestGet() {
  return new Response(HTML, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
