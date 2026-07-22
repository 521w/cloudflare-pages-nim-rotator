// functions/admin/_middleware.js
// Middleware for everything inside /admin/*
// In Pages Functions, _middleware.js exports onRequest that runs before each child route.

const COOKIE_NAME = 'nim_admin';

function html(content) {
  return new Response(content, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

async function isAuthed(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE_NAME + '='));
  if (!m) return false;
  const token = decodeURIComponent(m.split('=')[1] || '');
  const secret = env.ADMIN_SECRET || 'change-me';
  const expected = await sign(secret, 'nim-admin-cookie');
  return token === expected;
}

async function sign(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  // base64url
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Static assets (login page, panel HTML) skip auth for GET
  const path = url.pathname;

  // /admin/api/login and /admin/api/logout don't need auth (login sets the cookie)
  if (path === '/admin/api/login' || path === '/admin/api/logout') {
    return next();
  }

  // All other /admin/api/* require auth via cookie
  if (path.startsWith('/admin/api/')) {
    if (!(await isAuthed(request, env))) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return next();
  }

  // The HTML panel: render the same shell; client JS reads cookie and redirects if missing
  return next();
}
