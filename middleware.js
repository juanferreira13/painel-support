/* ------------------------------------------------------------------------- *
 * middleware.js — protege TODO o site com senha (HTTP Basic Auth). Roda no
 * Edge da Vercel, antes de qualquer página, asset ou /api.
 *
 * Agora MULTIUSUÁRIO por setor: cada login tem um papel e só enxerga o(s)
 * seu(s) dashboard(s). A regra de papéis fica em api/_auth.js (compartilhada
 * com /api/dados, que restringe os DADOS no servidor).
 *
 * Variáveis (Settings > Environment Variables na Vercel):
 *   VIEW_USERS     JSON { "usuario": { "senha": "...", "papel": "reguladores" } }
 *   VIEW_USER      (legado, opcional) admin — padrão "support"
 *   VIEW_PASSWORD  (legado, opcional) senha do admin (papel gerencial = vê tudo)
 * ------------------------------------------------------------------------- */
import { autenticar, temUsuarios } from "./api/_auth.js";

export const config = {
  // tudo, menos o favicon (não contém dados)
  matcher: ["/((?!favicon.ico).*)"],
};

export default function middleware(req) {
  if (!temUsuarios(process.env)) {
    return new Response("Site ainda não configurado: defina VIEW_USERS (ou VIEW_PASSWORD) nas variáveis de ambiente da Vercel.", {
      status: 503, headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  if (autenticar(req.headers.get("authorization"), process.env)) return; // libera

  return new Response("Acesso restrito ao Grupo Support.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Painel do Sinistro", charset="UTF-8"',
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
