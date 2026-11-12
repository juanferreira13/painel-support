/* ------------------------------------------------------------------------- *
 * /api/salvar — grava a DATA DA VISTORIA INICIAL dos reguladores no Sheets.
 *
 * POST { registros: [{ protocolo, campo, valor }] }
 * Só processa campo === "dataRegulagem" (ISO aaaa-mm-dd). Escreve na aba
 * BASE VISTORIA INICIAL do gerencial (coluna DATA DA ANALISE), casando por
 * PROTOCOLO SIGA — o integrador propaga sozinho para a aba VISTORIA INICIAL.
 * Protegido pela senha do site (middleware).
 * ------------------------------------------------------------------------- */
import { salvarVistoria } from "./_core.js";

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(obj));
}

async function lerCorpo(req) {
  if (req.body) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const txt = Buffer.concat(chunks).toString("utf8").trim();
  return txt ? JSON.parse(txt) : {};
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { erro: "use POST" });
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const sheetSinistro = process.env.SHEET_SINISTRO;
  if (!saJson || !sheetSinistro) return json(res, 501, { configurado: false, erro: "GOOGLE_SERVICE_ACCOUNT_JSON / SHEET_SINISTRO ausentes." });

  let corpo;
  try { corpo = await lerCorpo(req); } catch (_) { return json(res, 400, { erro: "JSON inválido" }); }
  const registros = Array.isArray(corpo && corpo.registros) ? corpo.registros : [];

  // Fase 2: só a Data da Vistoria Inicial. Última data por protocolo vence.
  const porProt = new Map();
  for (const r of registros) {
    if (!r || r.campo !== "dataRegulagem") continue;
    const prot = String(r.protocolo || "").trim();
    if (prot) porProt.set(prot, String(r.valor || "").trim());
  }
  const writes = [...porProt.entries()].map(([protocolo, dataIso]) => ({ protocolo, dataIso }));
  if (!writes.length) return json(res, 200, { ok: true, atualizados: 0, criados: 0, ignorados: registros.length });

  try {
    const r = await salvarVistoria({ saJson, sheetSinistro }, writes);
    return json(res, 200, r);
  } catch (e) {
    return json(res, 502, { erro: "Falha ao gravar no Sheets: " + (e && e.message || e) });
  }
}
