// functions/admin/api/logout.js
// POST /admin/api/logout — clears cookie

export async function onRequestPost() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'nim_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Secure',
    },
  });
}
