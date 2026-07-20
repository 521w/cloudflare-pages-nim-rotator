// functions/health.js
// 健康检查端点 · 返回 OK + 当前活跃 key 数

export async function onRequestGet(context) {
  const { env } = context;
  let active = 0;
  let inCooldown = 0;
  let disabled = 0;
  let total = 0;
  const ids = [];
  try {
    const list = await env.NIM_KEYS.list({ prefix: 'key:' });
    const now = Date.now();
    for (const k of list.keys) {
      const v = await env.NIM_KEYS.get(k.name, { type: 'json' });
      total++;
      if (!v) continue;
      if (v.active === false) { disabled++; ids.push({ id: k.name, status: 'disabled' }); continue; }
      if (v.cooldownUntil && v.cooldownUntil > now) {
        inCooldown++;
        ids.push({ id: k.name, status: 'cooldown', cooldownUntil: v.cooldownUntil });
      } else {
        active++;
        ids.push({ id: k.name, status: 'active' });
      }
    }
  } catch (e) {
    return new Response(JSON.stringify({ status: 'down', error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({
    status: 'ok',
    active_keys: active,
    cooldown_keys: inCooldown,
    disabled_keys: disabled,
    total_keys: total,
    keys: ids,
    service: 'nim-rotator',
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
