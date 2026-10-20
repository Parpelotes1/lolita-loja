function autorizado(request, env) {
  return request.headers.get('x-admin-password') === env.ADMIN_PASSWORD;
}

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM produtos ORDER BY id DESC'
  ).all();
  const produtos = results.map((p) => ({
    ...p,
    cores: JSON.parse(p.cores || '[]'),
    tamanhos: JSON.parse(p.tamanhos || '[]'),
    fotos: JSON.parse(p.fotos || '[]'),
  }));
  return Response.json(produtos);
}

export async function onRequestPost({ request, env }) {
  if (!autorizado(request, env)) {
    return Response.json({ erro: 'Não autorizado' }, { status: 401 });
  }
  const p = await request.json();
  if (!p.codigo || !p.nome || p.preco == null || !p.categoria) {
    return Response.json({ erro: 'Campos obrigatórios ausentes' }, { status: 400 });
  }
  try {
    const r = await env.DB.prepare(
      `INSERT INTO produtos
       (codigo, nome, descricao, preco, categoria, cores, tamanhos, fotos, foto_principal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      p.codigo.trim().toUpperCase(),
      p.nome,
      p.descricao || '',
      Number(p.preco),
      p.categoria,
      JSON.stringify(p.cores || []),
      JSON.stringify(p.tamanhos || []),
      JSON.stringify(p.fotos || []),
      Number(p.foto_principal || 0)
    ).run();
    return Response.json({ ok: true, id: r.meta.last_row_id }, { status: 201 });
  } catch (e) {
    if (String(e).includes('UNIQUE')) {
      return Response.json({ erro: 'Código já cadastrado' }, { status: 409 });
    }
    return Response.json({ erro: 'Erro ao salvar' }, { status: 500 });
  }
}
