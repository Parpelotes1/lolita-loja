export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Servir fotos do R2
    if (path.startsWith("/fotos/")) {
      const chave = path.replace("/fotos/", "");
      const objeto = await env.FOTOS.get(chave);
      if (!objeto) return new Response("Não encontrado", { status: 404 });
      return new Response(objeto.body, {
        headers: { "Content-Type": objeto.httpMetadata?.contentType || "image/jpeg" }
      });
    }

    // Login do admin
    if (path === "/api/login" && request.method === "POST") {
      const { senha } = await request.json();
      if (senha === env.ADMIN_PASSWORD) {
        return Response.json({ ok: true });
      }
      return Response.json({ ok: false }, { status: 401 });
    }

    // Listar produtos
    if (path === "/api/produtos" && request.method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM produtos ORDER BY criado_em DESC"
      ).all();
      return Response.json(results || []);
    }

    // Cadastrar produto (protegido por senha)
    if (path === "/api/produtos" && request.method === "POST") {
      if (!(await autorizar(request, env))) return new Response("Não autorizado", { status: 401 });
      const p = await request.json();
      await env.DB.prepare(
        `INSERT INTO produtos (id, codigo, nome, categoria, preco, tamanhos, cores, descricao, imagem, novo, destaque)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        p.id, p.codigo, p.nome, p.categoria, p.preco,
        JSON.stringify(p.tamanhos || []), JSON.stringify(p.cores || []),
        p.descricao || "", p.imagem || "", p.novo ? 1 : 0, p.destaque ? 1 : 0
      ).run();
      return Response.json({ ok: true });
    }

    // Excluir produto
    if (path.startsWith("/api/produtos/") && request.method === "DELETE") {
      if (!(await autorizar(request, env))) return new Response("Não autorizado", { status: 401 });
      const id = path.split("/").pop();
      await env.DB.prepare("DELETE FROM produtos WHERE id = ?").bind(id).run();
      return Response.json({ ok: true });
    }

    // Enviar foto para o R2
    if (path === "/api/upload" && request.method === "POST") {
      if (!(await autorizar(request, env))) return new Response("Não autorizado", { status: 401 });
      const form = await request.formData();
      const arquivo = form.get("arquivo");
      if (!arquivo) return new Response("Sem arquivo", { status: 400 });
      const chave = Date.now() + "-" + arquivo.name.replace(/\s+/g, "_");
      await env.FOTOS.put(chave, arquivo.stream(), {
        httpMetadata: { contentType: arquivo.type }
      });
      return Response.json({ ok: true, chave });
    }

    // Todo o resto: arquivos do site (index.html, produtos.html, etc.)
    return env.ASSETS.fetch(request);
  }
};

async function autorizar(request, env) {
  const token = request.headers.get("Authorization") || "";
  return token === "Bearer " + env.ADMIN_PASSWORD;
}
