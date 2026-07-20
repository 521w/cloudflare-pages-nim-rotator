// functions/admin/api/stats.js
// GET /admin/api/stats
// Reads aggregated counters from KV: stats:YYYY-MM-DD:total, stats:YYYY-MM-DD:byKey:[id], stats:YYYY-MM-DD:byStatus:[code]
// Returns last 7 days + today.

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

export async function onRequestGet(context) {
  const { env } = context;
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
    return json({ ok: true, today: today(), series });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
