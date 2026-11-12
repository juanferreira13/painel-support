/* ------------------------------------------------------------------------- *
 * middleware.js — protege TODO o site com senha (HTTP Basic Auth), como o
 * painel-web. Roda no Edge da Vercel, antes de qualquer página, asset ou /api.
 *
 * Variáveis (Settings > Environment Variables na Vercel):
 *   VIEW_USER     (opcional, padrão "support")
 *   VIEW_PASSWORD (obrigatória; sem ela o site fica bloqueado, p/ não vazar dados)
 * ------------------------------------------------------------------------- */
export const config = {
  // tudo, menos os assets de fonte do Google e o favicon (não contêm dados)
  matcher: ["/((?!favicon.ico).*)"],
};

export default function middleware(req) {
  const user = process.env.VIEW_USER || "support";
  const pass = process.env.VIEW_PASSWORD;

  if (!pass) {
    return new Response("Site ainda não configurado: defina VIEW_PASSWORD nas variáveis de ambiente da Vercel.", {
      status: 503, headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const cabecalho = req.headers.get("authorization") || "";
  const [tipo, valor] = cabecalho.split(" ");
  if ((tipo || "").toLowerCase() === "basic" && valor) {
    let u = "", s = "";
    try { [u, s] = atob(valor).split(":"); } catch (_) {}
    if (u === user && s === pass) return; // libera
  }

  return new Response("Acesso restrito ao Grupo Support.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Painel do Sinistro", charset="UTF-8"',
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
