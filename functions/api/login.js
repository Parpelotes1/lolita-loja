export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  if (!body.senha || body.senha !== env.ADMIN_PASSWORD) {
    return Response.json({ ok: false, erro: 'Senha incorreta' }, { status: 401 });
  }
  return Response.json({ ok: true });
}
