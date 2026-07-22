// functions/v1/chat/completions.js
// Cloudflare Pages Function · OpenAI 兼容 chat completions endpoint
// 多 key 轮换 · round-robin 起始点 · 撞限顺序试下一把 · 全部撞限才下沉

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

// 把一条调用日志推入 KV 最近 100 条轮转列表
async function appendLog(env, entry) {
  if (!env.NIM_STATS) return;
  const LOG_KEY = 'logs:recent';
  const MAX = 100;
  try {
    const raw = await env.NIM_STATS.get(LOG_KEY, { type: 'json' });
    const arr = Array.isArray(raw) ? raw : [];
    arr.unshift(entry);
    if (arr.length > MAX) arr.length = MAX;
    await env.NIM_STATS.put(LOG_KEY, JSON.stringify(arr), { expirationTtl: 60 * 60 * 24 * 30 }); // 30 天存活
  } catch (e) { /* 日志不影响主流程 */ }
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// 把一把 key 标进冷却（KV 写，in-request 失败数组同步）
const COOLDOWN_MIN_MS = 5 * 60 * 1000; // 默认 5 分钟

async function markCooldown(env, keyName, retryMs) {
  const v = await env.NIM_KEYS.get(keyName, { type: 'json' });
  if (!v) return;
  v.cooldownUntil = Date.now() + retryMs;
  v.lastFailStatus = 429;
  v.lastFailAt = Date.now();
  await env.NIM_KEYS.put(keyName, JSON.stringify(v));
}

// 推进 round-robin 索引并返回下一个起始序号
async function nextRRStart(env, candidateCount) {
  if (candidateCount <= 0) return 0;
  const cur = Number((await env.NIM_KEYS.get('pool:rrIndex', { type: 'json' })) || 0);
  const next = ((cur % candidateCount) + candidateCount) % candidateCount;
  await env.NIM_KEYS.put('pool:rrIndex', JSON.stringify(next + 1));
  return next;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: { message: 'invalid json body' } }, 400);
  }

  // 并行拉所有 key 记录（任务 2）
  const list = await env.NIM_KEYS.list({ prefix: 'key:' });
  const now = Date.now();
  const records = await Promise.all(
    list.keys.map(async (k) => {
      const v = await env.NIM_KEYS.get(k.name, { type: 'json' });
      return v ? { name: k.name, value: v.value, v } : null;
    })
  );

  const candidates = [];
  for (const r of records) {
    if (!r) continue;
    if (r.v.active === false) continue;
    if (r.v.cooldownUntil && r.v.cooldownUntil > now) continue;
    candidates.push(r);
  }

  if (candidates.length === 0) {
    await Promise.all([
      recordStat(env, 'total'),
      recordStat(env, 'fail'),
      recordStat(env, 'status:503'),
    ]);
    await appendLog(env, {
      ts: Date.now(),
      model: body?.model || '',
      status: 503,
      keyUsed: '',
      keysTried: 0,
      latencyMs: Date.now() - now,
      error: 'no candidates',
    });
    return jsonResponse({ error: { message: 'all keys cooling down or disabled' } }, 503);
  }

  // round-robin 起点（任务 1）
  const startIdx = await nextRRStart(env, candidates.length);
  const ordered = candidates.slice(startIdx).concat(candidates.slice(0, startIdx));

  let lastResp = null;
  let coolingKey = null;
  const triedKeys = [];

  for (let idx = 0; idx < ordered.length; idx++) {
    const chosen = ordered[idx];
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
      // 网络错=这把挂了，跳过下一把
      triedKeys.push(chosen.name);
      await markCooldown(env, chosen.name, COOLDOWN_MIN_MS);
      coolingKey = chosen.name;
      continue;
    }

    // 成功就直接返回，附带 used 信息
    if (resp.status !== 429 && resp.status !== 402) {
      // stats 并行写
      const statKeys = [`total`, `status:${resp.status}`, `key:${chosen.name}`];
      if (resp.status >= 200 && resp.status < 300) statKeys.push('ok');
      else statKeys.push('fail');
      await Promise.all(statKeys.map((k) => recordStat(env, k)));

      const txt = await resp.text();
      await appendLog(env, {
        ts: Date.now(),
        model: body?.model || '',
        status: resp.status,
        keyUsed: chosen.name,
        keysTried: idx + 1,
        latencyMs: Date.now() - now,
        error: resp.status >= 200 && resp.status < 300 ? '' : `status ${resp.status}`,
      });
      return new Response(txt, {
        status: resp.status,
        headers: {
          'Content-Type': 'application/json',
          'X-Key-Used': chosen.name,
          'X-RR-Offset': String(startIdx),
        },
      });
    }

    // 撞限:记冷却、试下一把
    triedKeys.push(chosen.name);
    const ra = Number(resp.headers.get('retry-after') || 0);
    const retryMs = ra > 0 ? ra * 1000 : COOLDOWN_MIN_MS;
    await markCooldown(env, chosen.name, retryMs);
    coolingKey = chosen.name;

    // 留 text 给最后兜底用,继续循环
    lastResp = resp;
  }

  // 全部撞完都没成
  if (lastResp) {
    await Promise.all([
      recordStat(env, 'total'),
      recordStat(env, 'fail'),
      recordStat(env, `status:${lastResp.status}`),
      recordStat(env, 'all_keys_cooling'),
    ]);
    const txt = await lastResp.text();
    await appendLog(env, {
      ts: Date.now(),
      model: body?.model || '',
      status: lastResp.status,
      keyUsed: coolingKey || '',
      keysTried: triedKeys.length,
      latencyMs: Date.now() - now,
      error: `all keys tried: ${triedKeys.join(',')}`,
    });
    return new Response(txt, {
      status: lastResp.status,
      headers: {
        'Content-Type': 'application/json',
        'X-Key-Cooling': coolingKey || '',
        'X-All-Keys-Tried': 'true',
      },
    });
  }

  // 全是网络错,没拿到任何上游响应
  await Promise.all([
    recordStat(env, 'total'),
    recordStat(env, 'fail'),
    recordStat(env, 'status:502'),
  ]);
  await appendLog(env, {
    ts: Date.now(),
    model: body?.model || '',
    status: 502,
    keyUsed: '',
    keysTried: triedKeys.length,
    latencyMs: Date.now() - now,
    error: `all keys network-failed: ${triedKeys.join(',')}`,
  });
  return jsonResponse({ error: { message: 'all keys network-failed' } }, 502);
}

export async function onRequestGet() {
  return jsonResponse({
    error: { message: 'method not allowed · use POST' },
    hint: 'POST {"model":"meta/llama-3.3-70b-instruct","messages":[...]}',
  }, 405);
}
