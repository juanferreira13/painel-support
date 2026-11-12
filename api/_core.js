/* ------------------------------------------------------------------------- *
 * _core.js — leitura do Google Sheets (conta de serviço) e mapeamento das
 * linhas para o formato que o painel consome (mesmo shape dos dados demo).
 *
 * Não é uma rota (prefixo "_"): é importado por api/dados.js. Também roda em
 * Node puro para teste local. Sem dependências externas: JWT assinado com
 * node:crypto e leitura via fetch na Sheets API v4 (somente leitura).
 * ------------------------------------------------------------------------- */
import crypto from "node:crypto";

/* ----------------------------------------------------------- auth (JWT RS256 -> access token) */
const b64url = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function obterToken(saJson) {
  const sa = typeof saJson === "string" ? JSON.parse(saJson) : saJson;
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  }));
  const assinado = `${head}.${claim}`;
  const sig = crypto.createSign("RSA-SHA256").update(assinado).sign(sa.private_key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${assinado}.${b64url(sig)}` }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error("falha na autenticação com o Google: " + (j.error_description || j.error || "sem token"));
  return j.access_token;
}

async function lerAba(token, sheetId, aba) {
  const rng = encodeURIComponent(`${aba}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${rng}?valueRenderOption=FORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;
  const res = await fetch(url, { headers: { authorization: "Bearer " + token } });
  const j = await res.json();
  if (j.error) throw new Error(`erro ao ler "${aba}" (${sheetId}): ${j.error.status} ${j.error.message}`);
  return j.values || [];
}

/* ----------------------------------------------------------- helpers de valor */
const trim = (v) => (v == null ? "" : String(v).trim());
const norm = (v) => trim(v).toUpperCase().replace(/\s+/g, " ");

// "dd/mm/aaaa" (ou "dd/mm/aa", ou já ISO) -> "aaaa-mm-dd"; vazio -> ""
function paraIso(v) {
  const s = trim(v);
  if (!s) return "";
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    let [_, d, mo, a] = m;
    if (a.length === 2) a = (Number(a) > 70 ? "19" : "20") + a;
    return `${a}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
}
function paraNumero(v) {
  const s = trim(v).replace(/[^\d,.-]/g, "");
  if (!s) return 0;
  // pt-BR: milhar "." e decimal "," -> remove "." e troca "," por "."
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function diasEntreIso(aIso, bIso) {
  if (!aIso || !bIso) return null;
  const a = Date.UTC(+aIso.slice(0, 4), +aIso.slice(5, 7) - 1, +aIso.slice(8, 10));
  const b = Date.UTC(+bIso.slice(0, 4), +bIso.slice(5, 7) - 1, +bIso.slice(8, 10));
  return Math.round((b - a) / 864e5);
}
const hojeIso = () => new Date().toISOString().slice(0, 10);

/* índice de cabeçalho: nome normalizado -> coluna. getter por lista de nomes (primeiro que casar). */
function indexador(cabecalho) {
  const idx = new Map();
  cabecalho.forEach((h, i) => { const k = norm(h); if (k && !idx.has(k)) idx.set(k, i); });
  return (linha, ...nomes) => {
    for (const n of nomes) { const i = idx.get(norm(n)); if (i != null) { const v = linha[i]; if (v != null && String(v) !== "") return v; } }
    return "";
  };
}

/* status -> sinais derivados (Fase 1: não há "status da regulação" na planilha) */
const CONCLUIDO_SGA = new Set(["FINALIZADO", "CONCLUIDO", "CONCLUÍDO"]);
const CONCLUIDO_SIGA = new Set(["ARQUIVADO", "LIBERADO", "FINALIZADO"]);
function sinais(statusSiga, statusSga) {
  const si = norm(statusSiga), sg = norm(statusSga);
  const negado = si === "NEGADO" || sg === "NEGADO";
  const concluido = !negado && (CONCLUIDO_SGA.has(sg) || CONCLUIDO_SIGA.has(si));
  let statusRegulacao = "Em regulação";
  if (negado) statusRegulacao = "Negado";
  else if (concluido) statusRegulacao = "Regularizado";
  return { negado, concluido, statusRegulacao };
}

/* ----------------------------------------------------------- mapeamento de uma linha */
function mapProcessoSiga(get) {
  const abertura = paraIso(get("Data abertura", "Data abertura SIGA"));
  let diasAberto = paraNumero(get("Dias em aberto"));
  if (!diasAberto && abertura) diasAberto = Math.max(0, diasEntreIso(abertura, hojeIso()) || 0);
  const statusSiga = trim(get("STATUS SIGA"));
  const statusSga = trim(get("STATUS SGA"));
  const { negado, concluido, statusRegulacao } = sinais(statusSiga, statusSga);
  const setor = norm(get("SETOR")) || "ANALISTAS";
  return {
    setor,
    protocoloSiga: trim(get("PROTOCOLO SIGA")) || trim(get("Número", "Numero")),
    protocoloSga: trim(get("PROTOCOLO SGA", "PROTOCOLO")),
    nome: trim(get("Nome")),
    cobertura: trim(get("Cobertura")),
    evento: trim(get("Evento", "TIPO EVENTO")).toUpperCase(),
    marca: trim(get("MARCA VEICULO", "MARCA")).toUpperCase(),
    modelo: trim(get("MODELO VEICULO", "MODELO")).toUpperCase(),
    cooperativa: trim(get("COOPERATIVA", "COOPERATIVAS")),
    placaSiga: trim(get("Placa SIGA", "Placa", "PLACA")),
    abertura,
    diasAberto,
    competencia: abertura ? abertura.slice(0, 7) : "",
    responsavel: trim(get("Responsável", "Responsavel")),
    reguladorAnalista: "",
    analista: trim(get("ANALISTA", "ANALISTA RESPONSAVEL")),
    cidade: trim(get("CIDADE", "ASSOCIADO CIDADE")),
    uf: trim(get("ESTADO", "ASSOCIADO ESTADO")).toUpperCase(),
    statusSga,
    statusSiga,
    classif: trim(get("CLASSIFICAÇÃO NEGATIVA", "MOTIVO NEGADO", "CLASSIFICACAO NEGATIVA")),
    oficina: trim(get("Oficina", "OFICINA SGA", "OFICINAS")),
    participacao: paraNumero(get("PARTICIPAÇÃO", "PARTICIPACAO")),
    // manuais (não vêm da aba SIGA)
    situacao: "", proxima: "", prazo: "", obs: "",
    regularizadoPor: "", dataRegulagem: "", mesReferencia: "", statusRegulacao: "",
    consultorTecnico: "",
    atualizadoEm: "", atualizadoPor: "",
    _negado: negado, _concluido: concluido,
  };
}

function mapProcessoRegulador(get) {
  const p = mapProcessoSiga(get);
  p.setor = "REGULADORES";
  p.responsavel = trim(get("REGULADOR SGA", "Responsável", "Regulador")) || p.responsavel;   // orçamentista
  p.reguladorAnalista = trim(get("REGULADOR ANALISTA"));
  p.statusRegulacao = sinais(p.statusSiga, p.statusSga).statusRegulacao;                      // derivado (Fase 1)
  return p;
}

/* ----------------------------------------------------------- carga completa */
export async function carregarTudo(cfg) {
  const { saJson, sheetSinistro, sheetReguladores } = cfg;
  const token = await obterToken(saJson);

  // Gerencial / analistas / consultores: aba SIGA (todos os sinistros)
  const siga = await lerAba(token, sheetSinistro, "SIGA");
  const getSiga = indexador(siga[0] || []);
  const gerais = siga.slice(1)
    .map((linha) => mapProcessoSiga((...nomes) => getSiga(linha, ...nomes)))
    .filter((p) => p.protocoloSiga);

  // BASE REGULADOR ANALISTA (NUMERO -> REGULADOR ANALISTA): casa o analista por protocolo
  const baseAnalista = new Map();
  try {
    const base = await lerAba(token, sheetSinistro, "BASE REGULADOR ANALISTA");
    const getB = indexador(base[0] || []);
    for (const linha of base.slice(1)) {
      const num = norm(getB(linha, "NUMERO", "ID EXTERNO", "PROTOCOLO"));
      const an = trim(getB(linha, "REGULADOR ANALISTA"));
      if (num && an) baseAnalista.set(num, an);
    }
  } catch (_) { /* aba opcional */ }
  const analistaDe = (p) => baseAnalista.get(norm(p.protocoloSga)) || baseAnalista.get(norm(p.protocoloSiga)) || "";

  // Reguladores: aba REGULADORES (tem REGULADOR ANALISTA e REGULADOR SGA)
  let reguladores = [];
  if (sheetReguladores) {
    const reg = await lerAba(token, sheetReguladores, "REGULADORES");
    const getReg = indexador(reg[0] || []);
    reguladores = reg.slice(1).map((linha) => mapProcessoRegulador((...nomes) => getReg(linha, ...nomes)))
      .filter((p) => p.protocoloSiga);
  }

  // base final: tudo do gerencial que NÃO é regulador + os reguladores (com analista)
  const naoReg = gerais.filter((p) => p.setor !== "REGULADORES");
  const processos = naoReg.concat(reguladores.length ? reguladores : gerais.filter((p) => p.setor === "REGULADORES"));
  // completa o regulador analista pela BASE quando a coluna da aba veio vazia
  for (const p of processos) if (p.setor === "REGULADORES" && !p.reguladorAnalista) p.reguladorAnalista = analistaDe(p);

  const LIXO = new Set(["", "#N/A", "N/A", "#REF!", "-", "NÃO INFORMADO", "NAO INFORMADO"]);
  const limpo = (v) => { const s = trim(v); return LIXO.has(s.toUpperCase()) ? "" : s; };
  const distintos = (arr, campo, filtro) => [...new Set(arr.filter(filtro || (() => true)).map((p) => limpo(p[campo])).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  // setores reais, por frequência (desc)
  const contSetor = new Map();
  for (const p of processos) { const s = trim(p.setor); if (s) contSetor.set(s, (contSetor.get(s) || 0) + 1); }
  const setoresReais = [...contSetor.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  const ehAnalista = (p) => p.setor === "ANALISTAS" || p.setor === "VIDROS";
  const listas = {
    analistas: distintos(processos, "analista", ehAnalista).length ? distintos(processos, "analista", ehAnalista) : distintos(processos, "responsavel", ehAnalista),
    reguladores: distintos(processos, "responsavel", (p) => p.setor === "REGULADORES"),
    reguladoresAnalistas: distintos(processos, "reguladorAnalista", (p) => p.setor === "REGULADORES"),
    consultores: distintos(processos, "responsavel", (p) => p.setor === "CONSULTORES"),
    marcas: distintos(processos, "marca"),
    eventos: distintos(processos, "evento"),
    cooperativas: distintos(processos, "cooperativa"),
    situacoes: [], concluido: "Concluído",
    statusReg: ["Em regulação", "Regularizado", "Negado"],
    oficinas: [],
    setores: setoresReais.length ? setoresReais : ["ANALISTAS", "VIDROS", "REGULADORES", "CONSULTORES"],
  };
  const gerado = { iso: new Date().toISOString().slice(0, 16), br: new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }) };
  return { processos, listas, gerado };
}

export const _internos = { paraIso, paraNumero, sinais, indexador, mapProcessoSiga };
