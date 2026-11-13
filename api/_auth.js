/* ------------------------------------------------------------------------- *
 * _auth.js — autenticação multiusuário por SETOR (papel), compartilhada pelo
 * middleware (Edge) e por /api/dados (Node). Só usa APIs portáveis (atob/JSON),
 * sem dependências de Node, para rodar nos dois runtimes.
 *
 * Variáveis de ambiente (Vercel > Settings > Environment Variables):
 *   VIEW_USERS      JSON: { "usuario": { "senha": "...", "papel": "reguladores" }, ... }
 *                   papel ∈ gerencial | analistas | reguladores | consultores
 *   VIEW_USER       (legado, opcional) usuário admin — padrão "support"
 *   VIEW_PASSWORD   (legado, opcional) senha do admin → papel "gerencial" (vê tudo)
 *
 * Cada papel enxerga só os dashboards/dados do(s) seu(s) setor(es). "gerencial"
 * (Larissa/coordenação) vê o gerencial e os três setores.
 * ------------------------------------------------------------------------- */

// papel -> chaves de setor permitidas (as mesmas chaves de GRUPOS em dados.js)
export const PERMISSOES = {
  gerencial: ["sinistro", "analistas", "reguladores", "consultores"],
  analistas: ["analistas"],
  reguladores: ["reguladores"],
  consultores: ["consultores"],
};

const TODOS = PERMISSOES.gerencial;

function decodificarBasic(cabecalho) {
  const partes = String(cabecalho || "").split(" ");
  const tipo = (partes[0] || "").toLowerCase();
  const valor = partes[1];
  if (tipo !== "basic" || !valor) return null;
  let txt = "";
  try { txt = atob(valor); } catch (_) { return null; }
  const i = txt.indexOf(":");
  if (i < 0) return null;
  return { user: txt.slice(0, i), pass: txt.slice(i + 1) };
}

// Monta o mapa de usuários a partir das envs (VIEW_USERS + admin legado).
function lerUsuarios(env) {
  const mapa = {};
  try {
    const o = JSON.parse(env.VIEW_USERS || "{}");
    if (o && typeof o === "object") {
      for (const u in o) {
        const v = o[u] || {};
        const senha = v.senha != null ? v.senha : v.password;
        const papel = v.papel != null ? v.papel : v.role;
        mapa[u] = { senha: String(senha == null ? "" : senha), papel: String(papel || "gerencial") };
      }
    }
  } catch (_) { /* VIEW_USERS ausente ou inválida: segue só com o admin legado */ }

  if (env.VIEW_PASSWORD) {
    const adm = env.VIEW_USER || "support";
    if (!mapa[adm]) mapa[adm] = { senha: String(env.VIEW_PASSWORD), papel: "gerencial" };
  }
  return mapa;
}

export function temUsuarios(env) {
  return !!(env && (env.VIEW_USERS || env.VIEW_PASSWORD));
}

// Valida o header Authorization. Devolve { user, papel, permitidos } ou null.
export function autenticar(cabecalho, env) {
  const cred = decodificarBasic(cabecalho);
  if (!cred) return null;
  const reg = lerUsuarios(env)[cred.user];
  if (!reg || reg.senha === "" || reg.senha !== cred.pass) return null;
  const permitidos = PERMISSOES[reg.papel] || TODOS;
  return { user: cred.user, papel: reg.papel, permitidos };
}
