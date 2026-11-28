/* ------------------------------------------------------------------------- *
 * api/login.js — recebe { usuario, senha } da tela /login.html, valida contra
 * VIEW_USERS (via _auth.js) e, se bater, grava o cookie de sessão ASSINADO.
 * É o que substitui o popup do Basic Auth. Senhas nunca saem daqui.
 * ------------------------------------------------------------------------- */
import { validarSenha, assinarSessao, cookieSessao, HORAS_SESSAO } from "./_auth.js";

function responder(res, status, obj, cookie) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  if (cookie) res.setHeader("Set-Cookie", cookie);
  res.end(JSON.stringify(obj));
}

async function lerCorpo(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let txt = typeof req.body === "string" ? req.body : "";
  if (!txt) {
    try { const chunks = []; for await (const c of req) chunks.push(c); txt = Buffer.concat(chunks).toString("utf8"); }
    catch (_) { txt = ""; }
  }
  try { return JSON.parse(txt || "{}"); } catch (_) { return {}; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return responder(res, 405, { ok: false, erro: "Use POST." });
  const body = await lerCorpo(req);
  const usuario = String((body && body.usuario) || "").trim();
  const senha = body && body.senha != null ? String(body.senha) : "";
  const acesso = validarSenha(usuario, senha, process.env);
  if (!acesso) return responder(res, 401, { ok: false, erro: "Usuário ou senha inválidos." });
  const token = await assinarSessao(acesso, process.env, HORAS_SESSAO);
  if (!token) return responder(res, 500, { ok: false, erro: "Login indisponível: defina SESSION_SECRET na Vercel." });
  return responder(res, 200, { ok: true, papel: acesso.papel }, cookieSessao(token, HORAS_SESSAO * 3600));
}
