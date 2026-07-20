// functions/admin/api/login.js
// POST /admin/api/login   body: { password }
// Sets cookie nim_admin if password matches ADMIN_PASSWORD env.
// Plain HMAC-SHA-256 cookie, no JWT lib, single-secret.

const COOKIE_NAME = 'nim_admin';

function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

async function sign(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'invalid json' }, 400);
  }
  const expected = env.ADMIN_PASSWORD || '';
  const got = (body.password || '').toString();
  if (!expected) {
    return json({ ok: false, error: 'ADMIN_PASSWORD env not configured' }, 500);
  }
  if (got !== expected) {
    // Add small delay to slow brute force
    await new Promise(r => setTimeout(r, 600));
    return json({ ok: false, error: 'wrong password' }, 401);
  }
  const secret = env.ADMIN_SECRET || 'change-me-default-fallback';
  const token = await sign(secret, 'nim-admin-cookie');
  const cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400; Secure`;
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookie,
    },
  });
}

export async function onRequestGet() {
  return json({ ok: false, error: 'method not allowed · POST {password}' }, 405);
}
