/* api/logout.js — apaga o cookie de sessão e volta pra tela de login. */
import { cookieSessao } from "./_auth.js";

export default function handler(req, res) {
  res.statusCode = 200;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("Set-Cookie", cookieSessao("", 0));
  res.end(JSON.stringify({ ok: true }));
}
