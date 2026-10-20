export async function onRequestPost({ request, env }) {
  if (request.headers.get('x-admin-password') !== env.ADMIN_PASSWORD) {
    return Response.json({ erro: 'Não autorizado' }, { status: 401 });
  }
  const form = await request.formData();
  const arquivo = form.get('arquivo');
  if (!arquivo || typeof arquivo === 'string') {
    return Response.json({ erro: 'Arquivo ausente' }, { status: 400 });
  }
  const extensao = (arquivo.name.split('.').pop() || 'jpg').toLowerCase();
  const chave = `produtos/${crypto.randomUUID()}.${extensao}`;
  await env.FOTOS.put(chave, arquivo.stream(), {
    httpMetadata: { contentType: arquivo.type || 'image/jpeg' },
  });
  return Response.json({ url: `/fotos/${chave}` });
}
