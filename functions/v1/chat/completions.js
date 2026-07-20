// functions/v1/chat/completions.js
// Cloudflare Pages Function · OpenAI 兼容 chat completions endpoint
// 多 key 轮换 · 撞限记冷却到 KV · 写统计到另一个 KV namespace (NIM_STATS)

function todayUTC() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

async function recordStat(env, key, delta = 1) {
  if (!env.NIM_STATS) return; // 没绑就跳过
  const k = `stats:${todayUTC()}:${key}`;
  const cur = Number((await env.NIM_STATS.get(k)) || 0);
  await env.NIM_STATS.put(k, String(cur + delta), { expirationTtl: 60 * 60 * 24 * 14 }); // 14 天存活
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: { message: 'invalid json body' } }, 400);
  }

  // 拉 NIM keys
  const list = await env.NIM_KEYS.list({ prefix: 'key:' });
  const candidates = [];
  const now = Date.now();
  for (const k of list.keys) {
    const v = await env.NIM_KEYS.get(k.name, { type: 'json' });
    if (!v) continue;
    if (v.active === false) continue; // disabled
    if (v.cooldownUntil && v.cooldownUntil > now) continue;
    candidates.push({ name: k.name, value: v.value });
  }

  if (candidates.length === 0) {
    await recordStat(env, 'total');
    await recordStat(env, 'fail');
    await recordStat(env, 'status:503');
    return jsonResponse({ error: { message: 'all keys cooling down or disabled' } }, 503);
  }

  // 随机选一条
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];

  // 透传到 NVIDIA NIM
  let resp;
  try {
    resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${chosen.value}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    await recordStat(env, 'total');
    await recordStat(env, 'fail');
    await recordStat(env, 'status:502');
    return jsonResponse({ error: { message: 'NIM fetch failed' } }, 502);
  }

  // 撞限处理
  await recordStat(env, 'total');
  await recordStat(env, `status:${resp.status}`);
  await recordStat(env, `key:${chosen.name}`);

  if (resp.status === 429 || resp.status === 402) {
    const ra = Number(resp.headers.get('retry-after') || 0);
    const retryMs = ra > 0 ? ra * 1000 : 5 * 60 * 1000;
    const v = await env.NIM_KEYS.get(chosen.name, { type: 'json' });
    v.cooldownUntil = Date.now() + retryMs;
    v.lastFailStatus = resp.status;
    v.lastFailAt = Date.now();
    await env.NIM_KEYS.put(chosen.name, JSON.stringify(v));

    await recordStat(env, 'fail');
    const txt = await resp.text();
    return new Response(txt, {
      status: resp.status,
      headers: {
        'Content-Type': 'application/json',
        'X-Key-Cooling': chosen.name,
      },
    });
  }

  if (resp.status >= 200 && resp.status < 300) {
    await recordStat(env, 'ok');
  } else {
    await recordStat(env, 'fail');
  }

  // 透传
  const txt = await resp.text();
  return new Response(txt, {
    status: resp.status,
    headers: {
      'Content-Type': 'application/json',
      'X-Key-Used': chosen.name,
    },
  });
}

export async function onRequestGet() {
  return jsonResponse({
    error: { message: 'method not allowed · use POST' },
    hint: 'POST {"model":"meta/llama-3.3-70b-instruct","messages":[...]}',
  }, 405);
}
