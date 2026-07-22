// functions/admin/api/stats.js
// GET /admin/api/stats            — aggregated counters (last 7 days)
// GET /admin/api/stats?logs=N     — recent call logs (max 100, default 50)

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function today() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

function days(n) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`);
  }
  return out;
}

async function readCounter(env, key) {
  const v = await env.NIM_STATS.get(key);
  return v ? Number(v) : 0;
}

async function readBucket(env, prefix) {
  const out = {};
  const list = await env.NIM_STATS.list({ prefix });
  for (const k of list.keys) {
    const v = await env.NIM_STATS.get(k.name);
    if (v) out[k.name.split(':').slice(-1)[0].replace(/^\[|\]$/g, '')] = Number(v);
  }
  return out;
}

function fmtTs(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

async function handleLogs(env, request) {
  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('logs') || '50', 10)));
  if (!env.NIM_STATS) return json({ ok: true, logs: [] });
  const raw = await env.NIM_STATS.get('logs:recent', { type: 'json' });
  let arr = Array.isArray(raw) ? raw : [];
  arr = arr.slice(0, limit);
  const logs = arr.map((e) => ({ ...e, tsFmt: fmtTs(e.ts) }));
  return json({ ok: true, count: logs.length, logs });
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);

  // logs mode: /admin/api/stats?logs=N
  if (url.searchParams.has('logs')) {
    try {
      return await handleLogs(env, request);
    } catch (e) {
      return json({ ok: false, error: String(e) }, 500);
    }
  }

  // default: stats mode
  try {
    const ds = days(7);
    const series = [];
    for (const day of ds) {
      const total = await readCounter(env, `stats:${day}:total`);
      const ok = await readCounter(env, `stats:${day}:ok`);
      const fail = await readCounter(env, `stats:${day}:fail`);
      const byStatus = await readBucket(env, `stats:${day}:status:`);
      const byKey = await readBucket(env, `stats:${day}:key:`);
      series.push({ day, total, ok, fail, byStatus, byKey });
    }
    return json({ ok: true, today: today(), series, _v: 'logs_merged_v2' });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
