function autorizado(request, env) {
  return request.headers.get('x-admin-password') === env.ADMIN_PASSWORD;
}

export async function onRequestPut({ request, env, params }) {
  if (!autorizado(request, env)) {
    return Response.json({ erro: 'Não autorizado' }, { status: 401 });
  }
  const p = await request.json();
  try {
    await env.DB.prepare(
      `UPDATE produtos SET codigo=?, nome=?, descricao=?, preco=?, categoria=?,
       cores=?, tamanhos=?, fotos=?, foto_principal=? WHERE id=?`
    ).bind(
      p.codigo.trim().toUpperCase(),
      p.nome,
      p.descricao || '',
      Number(p.preco),
      p.categoria,
      JSON.stringify(p.cores || []),
      JSON.stringify(p.tamanhos || []),
      JSON.stringify(p.fotos || []),
      Number(p.foto_principal || 0),
      params.id
    ).run();
    return Response.json({ ok: true });
  } catch (e) {
    if (String(e).includes('UNIQUE')) {
      return Response.json({ erro: 'Código já cadastrado' }, { status: 409 });
    }
    return Response.json({ erro: 'Erro ao atualizar' }, { status: 500 });
  }
}

export async function onRequestDelete({ request, env, params }) {
  if (!autorizado(request, env)) {
    return Response.json({ erro: 'Não autorizado' }, { status: 401 });
  }
  await env.DB.prepare('DELETE FROM produtos WHERE id=?').bind(params.id).run();
  return Response.json({ ok: true });
}
