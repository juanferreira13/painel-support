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
        mapa[u] = { senha: String(senha == null ? "" : senha), papel: String(papel || "") };
      }
    }
  } catch (_) { /* VIEW_USERS ausente ou inválida: segue só com o admin legado */ }

  if (env.VIEW_PASSWORD) {
    const adm = env.VIEW_USER || "support";
    if (!mapa[adm]) mapa[adm] = { senha: String(env.VIEW_PASSWORD), papel: "gerencial" };
  }
  try {
    const adicionais = JSON.parse(env.VIEW_EXTRA_USERS || "{}");
    if (adicionais && typeof adicionais === "object" && !Array.isArray(adicionais)) {
      for (const [u, v] of Object.entries(adicionais)) {
        if (!Object.hasOwn(mapa, u) && v && typeof v === "object") {
          mapa[u] = { senha: String(v.senha || ""), papel: String(v.papel || "") };
        }
      }
    }
  } catch (_) { /* acessos adicionais inválidos não modificam os existentes */ }
  return mapa;
}

export function temUsuarios(env) {
  return !!(env && (env.VIEW_USERS || env.VIEW_PASSWORD || env.VIEW_EXTRA_USERS));
}

// Valida o header Authorization. Devolve { user, papel, permitidos } ou null.
export function autenticar(cabecalho, env) {
  const cred = decodificarBasic(cabecalho);
  if (!cred) return null;
  const reg = lerUsuarios(env)[cred.user];
  if (!reg || reg.senha === "" || reg.senha !== cred.pass) return null;
  const permitidos = PERMISSOES[reg.papel];
  if (!permitidos) return null;
  return { user: cred.user, papel: reg.papel, permitidos };
}

// Valida usuário+senha direto (usado por /api/login). Devolve o registro ou null.
export function validarSenha(usuario, senha, env) {
  const reg = lerUsuarios(env)[String(usuario || "")];
  if (!reg || reg.senha === "" || reg.senha !== String(senha == null ? "" : senha)) return null;
  const permitidos = PERMISSOES[reg.papel];
  if (!permitidos) return null;
  return { user: String(usuario), papel: reg.papel, permitidos };
}

/* ---------------- sessão por cookie (tira o popup do Basic Auth) ----------------
 * A tela /login.html grava um cookie de sessão ASSINADO (HMAC-SHA256 com a env
 * SESSION_SECRET). O middleware e /api/dados verificam esse cookie; sem ele, o
 * middleware redireciona pra /login — sem mandar WWW-Authenticate, então o
 * navegador NÃO mostra o popup. Só usa Web Crypto (crypto.subtle), que existe
 * no Edge e no Node. VIEW_USERS continua sendo a fonte dos logins/senhas. */
export const COOKIE_SESSAO = "gs_sessao";
export const HORAS_SESSAO = 12;

const _enc = new TextEncoder();
const _dec = new TextDecoder();
function _b64url(bytes) {
  const b = new Uint8Array(bytes); let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function _deB64url(str) {
  let s = String(str).replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function _chave(segredo) {
  return crypto.subtle.importKey("raw", _enc.encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

// lê o valor de um cookie do cabeçalho "Cookie"
export function lerCookie(cabecalho, nome) {
  for (const parte of String(cabecalho || "").split(";")) {
    const i = parte.indexOf("=");
    if (i > 0 && parte.slice(0, i).trim() === nome) return parte.slice(i + 1).trim();
  }
  return "";
}

// monta o Set-Cookie da sessão (maxAgeSeg=0 apaga o cookie — logout)
export function cookieSessao(token, maxAgeSeg) {
  const base = `${COOKIE_SESSAO}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`;
  return maxAgeSeg == null ? base : `${base}; Max-Age=${maxAgeSeg}`;
}

// assina { user, papel } -> "payload.assinatura"; null se faltar SESSION_SECRET
export async function assinarSessao(dados, env, horas = HORAS_SESSAO) {
  const segredo = env && env.SESSION_SECRET;
  if (!segredo) return null;
  const payload = { u: String(dados.user || ""), p: String(dados.papel || ""), exp: Date.now() + horas * 3600e3 };
  const corpo = _b64url(_enc.encode(JSON.stringify(payload)));
  const assin = await crypto.subtle.sign("HMAC", await _chave(segredo), _enc.encode(corpo));
  return corpo + "." + _b64url(assin);
}

// verifica o token do cookie -> { user, papel, permitidos } ou null
export async function verificarSessao(token, env) {
  const segredo = env && env.SESSION_SECRET;
  if (!segredo || !token) return null;
  const ponto = String(token).indexOf(".");
  if (ponto < 1) return null;
  const corpo = token.slice(0, ponto), assin = token.slice(ponto + 1);
  let ok = false;
  try { ok = await crypto.subtle.verify("HMAC", await _chave(segredo), _deB64url(assin), _enc.encode(corpo)); } catch (_) { return null; }
  if (!ok) return null;
  let payload;
  try { payload = JSON.parse(_dec.decode(_deB64url(corpo))); } catch (_) { return null; }
  if (!payload || typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
  const permitidos = PERMISSOES[payload.p];
  if (!permitidos) return null;
  return { user: payload.u, papel: payload.p, permitidos };
}

// resolve o acesso de uma requisição: cookie de sessão primeiro, Basic depois (legado/API).
// funciona com Request do Edge (headers.get) e com req do Node (headers.*)
export async function autenticarReq(req, env) {
  const h = (nome) => (req.headers && typeof req.headers.get === "function") ? req.headers.get(nome) : (req.headers && req.headers[nome]);
  const porCookie = await verificarSessao(lerCookie(h("cookie"), COOKIE_SESSAO), env);
  if (porCookie) return porCookie;
  return autenticar(h("authorization"), env);
}
