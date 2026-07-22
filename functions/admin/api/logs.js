// functions/admin/api/logs.js
// GET /admin/api/logs — return recent call logs from KV (logs:recent)
// Query: ?limit=N (max 100, default 50)

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fmtTs(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

export async function onRequestGet(context) {
  const { env, request } = context;
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));

    if (!env.NIM_STATS) return json({ ok: true, logs: [] });

    const raw = await env.NIM_STATS.get('logs:recent', { type: 'json' });
    let arr = Array.isArray(raw) ? raw : [];
    arr = arr.slice(0, limit);

    // format timestamps for display but keep raw ts too
    const logs = arr.map((e) => ({
      ...e,
      tsFmt: fmtTs(e.ts),
    }));

    return json({ ok: true, count: logs.length, logs });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
