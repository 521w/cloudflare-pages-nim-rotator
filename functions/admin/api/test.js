// functions/admin/api/test.js
// POST /admin/api/test  { id }
// Probes a single key against NVIDIA NIM: GET /v1/models with the key.
// Returns ok + latencyMs + model_count or error + status.

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch (e) { return json({ ok: false, error: 'invalid json' }, 400); }
  const id = body.id;
  if (!id) return json({ ok: false, error: 'id required' }, 400);

  const v = await env.NIM_KEYS.get(id, { type: 'json' });
  if (!v) return json({ ok: false, error: 'not found' }, 404);
  if (v.active === false) return json({ ok: false, error: 'inactive' }, 400);

  const start = Date.now();
  let resp;
  try {
    resp = await fetch('https://integrate.api.nvidia.com/v1/models', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${v.value}` },
    });
  } catch (e) {
    return json({ ok: false, error: 'fetch failed · ' + String(e), latencyMs: Date.now() - start }, 502);
  }
  const latencyMs = Date.now() - start;
  const txt = await resp.text();
  let parsed;
  try { parsed = JSON.parse(txt); } catch { parsed = null; }

  if (resp.status === 200) {
    return json({
      ok: true,
      status: resp.status,
      latencyMs,
      models: parsed && parsed.data ? parsed.data.length : 'unknown',
    });
  }
  return json({
    ok: false,
    status: resp.status,
    latencyMs,
    error: parsed && parsed.detail ? parsed.detail : txt.slice(0, 200),
  }, 200); // 200 because the API itself returned; the key is invalid
}
