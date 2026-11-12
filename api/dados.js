/* ------------------------------------------------------------------------- *
 * /api/dados — devolve os processos do painel lidos do Google Sheets.
 *
 * GET /api/dados?setor=sinistro|analistas|reguladores|consultores
 * Lê com a conta de serviço (env GOOGLE_SERVICE_ACCOUNT_JSON) e faz cache curto
 * em memória por instância. Não configurado -> 501 (o site cai no modo demo).
 * ------------------------------------------------------------------------- */
import { carregarTudo } from "./_core.js";

const FONTE = { tipo: "sheets", rotulo: "Dados ao vivo (Sheets)", live: true };
const GRUPOS = {
  sinistro: () => true,
  analistas: (p) => p.setor === "ANALISTAS" || p.setor === "VIDROS",
  reguladores: (p) => p.setor === "REGULADORES",
  consultores: (p) => p.setor === "CONSULTORES",
};

const TTL = 60_000;             // 60s de cache por instância quente
let cache = { t: 0, dados: null, erro: null };

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "private, no-store, max-age=0");
  res.end(JSON.stringify(obj));
}

export default async function handler(req, res) {
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const sheetSinistro = process.env.SHEET_SINISTRO;
  const sheetReguladores = process.env.SHEET_REGULADORES || "";
  if (!saJson || !sheetSinistro) {
    return json(res, 501, { configurado: false, erro: "Defina GOOGLE_SERVICE_ACCOUNT_JSON e SHEET_SINISTRO nas variáveis da Vercel." });
  }
  let chave = "sinistro";
  try { chave = new URL(req.url, "http://x").searchParams.get("setor") || "sinistro"; } catch (_) {}
  if (!GRUPOS[chave]) chave = "sinistro";

  try {
    const agora = Date.now();
    if (!cache.dados || agora - cache.t > TTL) {
      cache = { t: agora, dados: await carregarTudo({ saJson, sheetSinistro, sheetReguladores }), erro: null };
    }
    const { processos, listas, gerado } = cache.dados;
    const saida = processos.filter(GRUPOS[chave]);
    return json(res, 200, { chave, processos: saida, gerado, listas, fonte: FONTE });
  } catch (e) {
    cache = { t: 0, dados: null, erro: String(e && e.message || e) };
    return json(res, 502, { erro: "Falha ao ler o Google Sheets: " + (e && e.message || e) });
  }
}
