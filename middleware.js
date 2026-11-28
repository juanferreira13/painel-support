/* ------------------------------------------------------------------------- *
 * middleware.js — protege TODO o site. Roda no Edge da Vercel, antes de
 * qualquer página, asset ou /api.
 *
 * SEM POPUP: em vez de responder 401 com WWW-Authenticate (o que faz o
 * navegador abrir o popup nativo), este middleware verifica o COOKIE de sessão
 * (gravado pela tela /login.html via /api/login) e, sem sessão válida,
 * REDIRECIONA pra /login.html. O Basic Auth continua aceito para clientes de
 * API/legado. Regra de papéis e cookie em api/_auth.js (compartilhada com
 * /api/dados, que restringe os DADOS no servidor).
 * ------------------------------------------------------------------------- */
import { autenticar, temUsuarios, verificarSessao, lerCookie, COOKIE_SESSAO } from "./api/_auth.js";

export const config = {
  // tudo, menos o favicon (não contém dados)
  matcher: ["/((?!favicon.ico).*)"],
};

// a própria tela de login e seus endpoints passam sem sessão
const LIVRE = new Set(["/login", "/login.html", "/api/login", "/api/logout"]);

export default async function middleware(req) {
  if (!temUsuarios(process.env)) {
    return new Response("Site ainda não configurado: defina VIEW_USERS (ou VIEW_PASSWORD) nas variáveis de ambiente da Vercel.", {
      status: 503, headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const url = new URL(req.url);
  const path = url.pathname;
  // A tela de login só "liga" quando SESSION_SECRET existe. Sem ela, mantém o
  // popup antigo (Basic Auth) — assim subir este código antes de configurar a
  // env na Vercel NÃO trava o acesso de ninguém.
  const temSessao = !!process.env.SESSION_SECRET;

  // já autenticado? cookie de sessão primeiro; Basic ainda aceito (API/legado/transição)
  const porCookie = temSessao
    ? await verificarSessao(lerCookie(req.headers.get("cookie"), COOKIE_SESSAO), process.env)
    : null;
  if (porCookie || autenticar(req.headers.get("authorization"), process.env)) return;

  // Modo legado (sem SESSION_SECRET): popup do Basic Auth, como antes.
  if (!temSessao) {
    return new Response("Acesso restrito ao Grupo Support.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Painel do Sinistro", charset="UTF-8"',
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }

  if (LIVRE.has(path)) return;

  // navegação de página (browser) -> tela de login, SEM WWW-Authenticate = sem popup
  if ((req.headers.get("accept") || "").includes("text/html")) {
    const destino = new URL("/login.html", url);
    const alvo = path + (url.search || "");
    if (alvo && alvo !== "/") destino.searchParams.set("next", alvo);
    return Response.redirect(destino, 302);
  }
  // fetch de API/asset sem sessão -> 401 sem o header do popup
  return new Response("Acesso restrito ao Grupo Support.", {
    status: 401, headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
