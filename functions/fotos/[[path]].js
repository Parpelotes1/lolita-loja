
export async function onRequestGet({ env, params }) {
  const chave = Array.isArray(params.path) ? params.path.join('/') : params.path;
  const objeto = await env.FOTOS.get(`produtos/${chave.replace(/^produtos\//, '')}`);
  if (!objeto) return new Response('Não encontrado', { status: 404 });
  return new Response(objeto.body, {
    headers: {
      'Content-Type': objeto.httpMetadata?.contentType || 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000',
    },
  });
}
