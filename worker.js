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
        headers: {
          "Content-Type": objeto.httpMetadata?.contentType || "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable"
        }
      });
    }

    // Login do admin
    if (path === "/api/login" && request.method === "POST") {
      let senha = "";
      try {
        const corpo = await request.json();
        senha = corpo.senha;
      } catch (e) {
        return Response.json({ ok: false, erro: "Corpo invalido" }, { status: 400 });
      }
      if (senha && senha === env.ADMIN_PASSWORD) {
        return Response.json({ ok: true, token: env.ADMIN_PASSWORD });
      }
      return Response.json({ ok: false }, { status: 401 });
    }

    // Listar produtos
    if (path === "/api/produtos" && request.method === "GET") {
      try {
        const { results } = await env.DB.prepare(
          "SELECT * FROM produtos ORDER BY criado_em DESC"
        ).all();
        const lista = (results || []).map((p) => ({
          ...p,
          tamanhos: tentarJson(p.tamanhos, []),
          cores: tentarJson(p.cores, []),
          novo: !!p.novo,
          destaque: !!p.destaque
        }));
        return Response.json(lista);
      } catch (e) {
        return Response.json({ erro: String(e) }, { status: 500 });
      }
    }

    // Cadastrar produto
    if (path === "/api/produtos" && request.method === "POST") {
      if (!(await autorizar(request, env))) return new Response("Não autorizado", { status: 401 });
      try {
        const p = await request.json();
        if (!p.id) p.id = crypto.randomUUID();
        const agora = new Date().toISOString();
        await env.DB.prepare(
          `INSERT INTO produtos (id, codigo, nome, categoria, preco, tamanhos, cores, descricao, imagem, novo, destaque, criado_em)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          p.id, p.codigo, p.nome, p.categoria, p.preco,
          JSON.stringify(p.tamanhos || []), JSON.stringify(p.cores || []),
          p.descricao || "", p.imagem || "", p.novo ? 1 : 0, p.destaque ? 1 : 0, agora
        ).run();
        return Response.json({ ok: true, id: p.id });
      } catch (e) {
        return Response.json({ ok: false, erro: String(e) }, { status: 500 });
      }
    }

    // Editar produto (NOVO)
    if (path.startsWith("/api/produtos/") && request.method === "PUT") {
      if (!(await autorizar(request, env))) return new Response("Não autorizado", { status: 401 });
      const id = decodeURIComponent(path.split("/").pop());
      try {
        const p = await request.json();
        await env.DB.prepare(
          `UPDATE produtos SET codigo=?, nome=?, categoria=?, preco=?, tamanhos=?, cores=?, descricao=?, imagem=?, novo=?, destaque=? WHERE id=?`
        ).bind(
          p.codigo, p.nome, p.categoria, p.preco,
          JSON.stringify(p.tamanhos || []), JSON.stringify(p.cores || []),
          p.descricao || "", p.imagem || "", p.novo ? 1 : 0, p.destaque ? 1 : 0, id
        ).run();
        return Response.json({ ok: true, id });
      } catch (e) {
        return Response.json({ ok: false, erro: String(e) }, { status: 500 });
      }
    }

    // Excluir produto
    if (path.startsWith("/api/produtos/") && request.method === "DELETE") {
      if (!(await autorizar(request, env))) return new Response("Não autorizado", { status: 401 });
      const id = decodeURIComponent(path.split("/").pop());
      try {
        await env.DB.prepare("DELETE FROM produtos WHERE id = ?").bind(id).run();
        return Response.json({ ok: true, id });
      } catch (e) {
        return Response.json({ ok: false, erro: String(e) }, { status: 500 });
      }
    }

    // Enviar foto para o R2
    if (path === "/api/upload" && request.method === "POST") {
      if (!(await autorizar(request, env))) return new Response("Não autorizado", { status: 401 });
      try {
        const tipo = request.headers.get("content-type") || "";
        if (!tipo.includes("multipart/form-data")) {
          return Response.json(
            { ok: false, erro: "Envie a foto como multipart/form-data no campo 'arquivo'" },
            { status: 415 }
          );
        }
        const form = await request.formData();
        // ATENÇÃO: o nome do campo é "arquivo". Se mudar aqui, mude no admin.html também.
        const arquivo = form.get("arquivo");
        if (!arquivo || typeof arquivo === "string") {
          return Response.json({ ok: false, erro: "Sem arquivo no campo 'arquivo'" }, { status: 400 });
        }
        if (arquivo.size > 10 * 1024 * 1024) {
          return Response.json({ ok: false, erro: "Arquivo maior que 10 MB" }, { status: 413 });
        }
        const nomeLimpo = (arquivo.name || "foto.jpg").replace(/[^a-zA-Z0-9._-]/g, "_");
        const chave = Date.now() + "-" + nomeLimpo;
        await env.FOTOS.put(chave, arquivo.stream(), {
          httpMetadata: { contentType: arquivo.type || "image/jpeg" }
        });
        return Response.json({ ok: true, chave, url: "/fotos/" + chave });
      } catch (e) {
        return Response.json({ ok: false, erro: String(e) }, { status: 500 });
      }
    }

    // Todo o resto: arquivos do site
    const resposta = await env.ASSETS.fetch(request);
    const ct = resposta.headers.get("content-type") || "";
    if (ct.includes("text/html")) {
      const nova = new Response(resposta.body, resposta);
      nova.headers.set("Cache-Control", "no-store, must-revalidate");
      return nova;
    }
    return resposta;
  }
};

function tentarJson(valor, padrao) {
  if (valor === null || valor === undefined) return padrao;
  if (typeof valor !== "string") return valor;
  try {
    const r = JSON.parse(valor);
    return Array.isArray(r) ? r : padrao;
  } catch (e) {
    return padrao;
  }
}

async function autorizar(request, env) {
  const token = request.headers.get("Authorization") || "";
  return token === "Bearer " + env.ADMIN_PASSWORD;
}
