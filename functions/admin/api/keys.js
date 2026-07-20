// functions/admin/api/keys.js
// GET       /admin/api/keys           list keys (masks value, shows cooldownUntil + status)
// POST      /admin/api/keys           add key    { id?, value }
// PUT/PATCH /admin/api/keys           update     { id, value?, cooldownUntil? }
// DELETE    /admin/api/keys           delete     ?id=key:1
// POST      /admin/api/keys?action=toggle  toggle active flag  { id }
// POST      /admin/api/keys?action=clear-cooldown   clear cooldown { id }

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mask(value) {
  if (!value) return '';
  if (value.length <= 12) return '***';
  return value.slice(0, 7) + '...' + value.slice(-4);
}

async function readAll(env) {
  const out = [];
  const list = await env.NIM_KEYS.list({ prefix: 'key:' });
  const now = Date.now();
  for (const k of list.keys) {
    const v = await env.NIM_KEYS.get(k.name, { type: 'json' });
    if (!v) continue;
    const cool = v.cooldownUntil && v.cooldownUntil > now;
    out.push({
      id: k.name,
      value_masked: mask(v.value),
      value: v.value, // also return full for owner
      cooldownUntil: v.cooldownUntil || 0,
      cooldownRemainMs: cool ? v.cooldownUntil - now : 0,
      cooldown: cool,
      active: v.active !== false,
      lastFailStatus: v.lastFailStatus || null,
      lastFailAt: v.lastFailAt || null,
      note: v.note || '',
      addedAt: v.addedAt || null,
      expiresAt: v.expiresAt || null,
    });
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const list = await readAll(env);
    return json({ ok: true, keys: list });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  let body;
  try { body = await request.json(); } catch (e) { return json({ ok: false, error: 'invalid json' }, 400); }

  // toggle
  if (action === 'toggle') {
    const id = body.id;
    if (!id) return json({ ok: false, error: 'id required' }, 400);
    const v = await env.NIM_KEYS.get(id, { type: 'json' });
    if (!v) return json({ ok: false, error: 'not found' }, 404);
    v.active = v.active === false ? true : false;
    await env.NIM_KEYS.put(id, JSON.stringify(v));
    return json({ ok: true, id, active: v.active });
  }

  // clear-cooldown
  if (action === 'clear-cooldown') {
    const id = body.id;
    if (!id) return json({ ok: false, error: 'id required' }, 400);
    const v = await env.NIM_KEYS.get(id, { type: 'json' });
    if (!v) return json({ ok: false, error: 'not found' }, 404);
    v.cooldownUntil = 0;
    delete v.lastFailStatus;
    delete v.lastFailAt;
    await env.NIM_KEYS.put(id, JSON.stringify(v));
    return json({ ok: true, id });
  }

  // default: add new
  const id = body.id || `key:${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const value = body.value;
  if (!value || typeof value !== 'string' || !value.startsWith('nvapi-')) {
    return json({ ok: false, error: 'value must look like nvapi-...' }, 400);
  }
  const rec = {
    value,
    cooldownUntil: 0,
    active: true,
    note: (body.note || '').toString().slice(0, 200),
    addedAt: Date.now(),
  };
  await env.NIM_KEYS.put(id, JSON.stringify(rec));
  return json({ ok: true, id });
}

export async function onRequestPut(context) {
  return modify(context);
}
export async function onRequestPatch(context) {
  return modify(context);
}

async function modify(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch (e) { return json({ ok: false, error: 'invalid json' }, 400); }
  const id = body.id;
  if (!id) return json({ ok: false, error: 'id required' }, 400);
  const v = await env.NIM_KEYS.get(id, { type: 'json' });
  if (!v) return json({ ok: false, error: 'not found' }, 404);
  if (typeof body.value === 'string') v.value = body.value;
  if (typeof body.note === 'string') v.note = body.note.slice(0, 200);
  if (typeof body.active === 'boolean') v.active = body.active;
  if (typeof body.cooldownUntil === 'number') v.cooldownUntil = body.cooldownUntil;
  await env.NIM_KEYS.put(id, JSON.stringify(v));
  return json({ ok: true, id });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return json({ ok: false, error: 'id required' }, 400);
  await env.NIM_KEYS.delete(id);
  return json({ ok: true, id });
}
