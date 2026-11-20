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

export async function obterToken(saJson, escopo) {
  const sa = typeof saJson === "string" ? JSON.parse(saJson) : saJson;
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: escopo || "https://www.googleapis.com/auth/spreadsheets.readonly",
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
export function vistoriaDosAnalistas(p) {
  const tarefa = norm(p.tarefa).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return norm(p.setor) === 'ANALISTAS' && ['COMUNICAR AUTORIZACAO', 'ANALISAR NECESSIDADE DE CARRO RESERVA'].includes(tarefa);
}
const nomeValido = (v) => { const s = trim(v); return /[A-Za-zÀ-ÿ]/.test(s) && !/\d/.test(s) && !/^(N[ÃA]O INFORMADO|N\/A|#REF!)$/i.test(s) ? s : ''; };

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
// formata CPF/CNPJ quando vier limpo (14/11 dígitos); senão devolve como está
function cnpjFmt(v) {
  const s = trim(v);
  const d = s.replace(/\D/g, "");
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return s;
}
// "aaaa-mm-dd" -> "dd/mm/aaaa" (formato da planilha); vazio -> ""
function isoParaBr(v) {
  const s = trim(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}
// índice da 1ª coluna cujo título casa (normalizado); -1 se nenhuma
function acharCol(header, nomes) {
  const alvo = nomes.map((n) => norm(n));
  for (let i = 0; i < header.length; i++) if (alvo.includes(norm(header[i]))) return i;
  return -1;
}
// letra(s) de coluna A1 a partir do índice 0-based
function colLetra(i) { let s = ""; i++; while (i) { s = String.fromCharCode(65 + (i - 1) % 26) + s; i = Math.floor((i - 1) / 26); } return s; }

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
export function indexador(cabecalho) {
  const idx = new Map();
  cabecalho.forEach((h, i) => { const k = norm(h); if (k) { if (!idx.has(k)) idx.set(k, []); idx.get(k).push(i); } });
  return (linha, ...nomes) => {
    for (const n of nomes) for (const i of idx.get(norm(n)) || []) { const v = linha[i]; if (v != null && String(v).trim() !== "") return v; }
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
export function mapProcessoSiga(get) {
  const abertura = paraIso(get("Data abertura", "Data abertura SIGA"));
  let diasAberto = paraNumero(get("Dias em aberto"));
  if (!diasAberto && abertura) diasAberto = Math.max(0, diasEntreIso(abertura, hojeIso()) || 0);
  const statusSiga = trim(get("STATUS SIGA"));
  const statusSga = trim(get("STATUS SGA"));
  const { negado, concluido, statusRegulacao } = sinais(statusSiga, statusSga);
  const setor = norm(get("SETOR")) || "ANALISTAS";
  return {
    setor,
    porTarefa: norm(get("POR TAREFA")),
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
    // campos extras (para o gerencial / listas / acusar)
    veiculo: trim(get("Veículo", "Veiculo", "Tipo Veículo")),
    tarefa: trim(get("Tarefa", "TAREFA")),
    dataComunicado: paraIso(get("DATA COMUNICADO EVENTO")),
    diasUteisComunicado: trim(get("DIAS UTEIS COMUNICADO", "DIAS UTEIS DE COMUNICADO", "DIAS UTEIS DO COMUNICADO")),
    dataAutorizado: paraIso(get("DATA AUTORIZADO", "DATA AUTORIZAÇÃO", "DATA AUTORIZACAO")),
    diasUteisAutorizado: trim(get("DIAS UTEIS AUTORIZADO", "DIAS UTEIS DE AUTORIZAÇÃO", "DIAS UTEIS DO AUTORIZAÇÃO", "DIAS UTEIS DE AUTORIZACAO")),
    diasAtrasoSiga: trim(get("Dias em atraso", "Dias em atraso SIGA")),
    diasAtraso: paraNumero(get("Dias em atraso", "Dias em atraso SIGA")),   // coluna O do SIGA (> 0 = atrasado)
    placaSga: trim(get("PLACA SGA")),
    mesRefSiga: trim(get("MÊS REF SIGA", "MES REF SIGA")),
    oficinaSga: trim(get("OFICINA SGA", "OFICINAS")),
    cnpj: trim(get("CNPJ", "CPF/CNPJ")),
    regulador: trim(get("Regulador", "REGULADOR SGA")),
    voluntario: trim(get("VOLUNTARIO", "VOLUNTÁRIO")),
    dataEvento: paraIso(get("DATA EVENTO")),
    campoAdicional: trim(get("CAMPO ADICIONAL", "CAMPO ADICIONAL EVENTO")),
    consultor: trim(get("CONSULTOR COMERCIAL", "CONSULTOR", "VOLUNTARIO", "VOLUNTÁRIO")),
    // manuais (não vêm da aba SIGA)
    situacao: "", proxima: "", prazo: "", obs: "",
    regularizadoPor: "", dataRegulagem: "", mesReferencia: "", statusRegulacao: "",
    consultorTecnico: trim(get("CONSULTOR TECNICO", "CONSULTOR TÉCNICO")),
    atualizadoEm: "", atualizadoPor: "",
    _negado: negado, _concluido: concluido,
  };
}

const STATUS_APENAS_SGA = new Set(["EXCLUIR", "ONLINE", "NOTIFICADO"]);
const chaveProcesso = (protocolo, cobertura, nome) => {
  const partes = [protocolo, cobertura, nome].map(norm);
  return partes.every(Boolean) ? partes.join("|") : "";
};

// Cada linha do SGA é um item (associado ou terceiro). Só incorpora os três
// status pedidos e nunca supõe status, tarefa ou protocolo SIGA inexistentes.
export function incorporarStatusSga(processos, tabela) {
  const get = indexador(tabela[0] || []);
  const porChave = new Map();
  for (const p of processos) {
    const k = chaveProcesso(p.protocoloSga, p.cobertura, p.nome);
    if (k) (porChave.get(k) || porChave.set(k, []).get(k)).push(p);
  }
  for (const linha of tabela.slice(1)) {
    const g = (...nomes) => get(linha, ...nomes);
    const statusSga = norm(g("SITUACAO EVENTO", "SITUAÇÃO EVENTO"));
    if (!STATUS_APENAS_SGA.has(statusSga)) continue;
    const protocoloSga = trim(g("PROTOCOLO"));
    const nome = trim(g("NOME TERCEIRO")) || trim(g("NOME ASSOCIADO"));
    const cobertura = trim(g("TIPO EVENTO"));
    const chave = chaveProcesso(protocoloSga, cobertura, nome);
    if (!chave) continue; // sem identificação suficiente não inventa vínculo
    const existentes = porChave.get(chave);
    if (existentes) {
      for (const p of existentes) {
        p.statusSga = statusSga;
        p._analistasSGA = true;
        const atual = sinais(p.statusSiga, statusSga);
        p._negado = atual.negado;
        p._concluido = atual.concluido;
        if (p.setor === "REGULADORES") p.statusRegulacao = atual.statusRegulacao;
      }
      continue;
    }
    const terceiro = !!trim(g("NOME TERCEIRO"));
    const placa = trim(terceiro ? g("PLACA TERCEIRO") : g("PLACA"));
    const dataComunicado = paraIso(g("DATA COMUNICADO EVENTO"));
    const p = {
      ...mapProcessoSiga(() => ""),
      setor: "SEM SETOR SIGA", protocoloSiga: "", protocoloSga, nome, cobertura,
      evento: norm(g("MOTIVO EVENTO")), statusSga, statusSiga: "", placaSiga: "", placaSga: placa,
      analista: trim(g("ANALISTA RESPONSAVEL", "ANALISTA RESPONSÁVEL")),
      cidade: trim(g("ASSOCIADO CIDADE")), uf: norm(g("ASSOCIADO ESTADO")),
      cooperativa: trim(g("COOPERATIVA")), participacao: paraNumero(g("PARTICIPAÇÃO", "PARTICIPACAO")),
      dataComunicado, competencia: dataComunicado ? dataComunicado.slice(0, 7) : "",
      dataAutorizado: paraIso(g("DATA DA AUTORIZACAO", "DATA DA AUTORIZAÇÃO")),
      dataEvento: paraIso(g("DATA EVENTO")), marca: norm(g("MARCA VEICULO")), modelo: norm(g("MODELO VEICULO")),
      veiculo: trim(g("MODELO VEICULO")), oficinaSga: trim(g("NOME FANTASIA OFICINA", "NOME FANTASIA FORNECEDOR", "NOME FORNECEDOR", "NOME FANTASIA")),
      campoAdicional: trim(g("CAMPO ADICIONAL EVENTO")), consultor: trim(g("VOLUNTARIO", "VOLUNTÁRIO")),
      consultorTecnico: trim(g("CONTATO")), classif: trim(g("MOTIVO NEGADO", "CLASSIFICACAO")),
      diasAberto: null, _somenteSGA: true, _analistasSGA: true,
    };
    processos.push(p);
    porChave.set(chave, [p]);
  }
  return processos;
}

function mapProcessoRegulador(get) {
  const p = mapProcessoSiga(get);
  p.setor = "REGULADORES";
  p.responsavel = trim(get("REGULADOR SGA", "Responsável", "Regulador")) || p.responsavel;   // orçamentista
  p.reguladorAnalista = nomeValido(get("REGULADOR ANALISTA")) || nomeValido(get("ID EXTERNO"));
  p.statusRegulacao = sinais(p.statusSiga, p.statusSga).statusRegulacao;                      // derivado (Fase 1)
  return p;
}

/* ----------------------------------------------------------- carga completa */
export async function carregarTudo(cfg) {
  const { saJson, sheetSinistro, sheetReguladores } = cfg;
  const token = await obterToken(saJson);

  // Lê as abas necessárias EM PARALELO (corta a latência e evita timeout da função na Vercel).
  const [siga, baseAna, baseVis, reg, ofiAba, sga, atualizacao] = await Promise.all([
    lerAba(token, sheetSinistro, "SIGA"),
    lerAba(token, sheetSinistro, "BASE REGULADOR ANALISTA").catch(() => []),
    lerAba(token, sheetSinistro, "BASE VISTORIA INICIAL").catch(() => []),
    sheetReguladores ? lerAba(token, sheetReguladores, "REGULADORES").catch(() => []) : Promise.resolve([]),
    lerAba(token, sheetSinistro, "OFICINAS").catch(() => []),
    lerAba(token, sheetSinistro, "SGA!A:AF"),
    lerAba(token, sheetSinistro, "_ATUALIZACAO_INTEGRADOR!A1:B2").catch(() => []),
  ]);

  // Gerencial / analistas / consultores: aba SIGA (todos os sinistros)
  const getSiga = indexador(siga[0] || []);
  // orçamentista do regulador = coluna AM do SIGA (índice 38). Guardado por protocolo
  // para preencher os processos dos reguladores (col AM do SIGA ou col T do SGA).
  const orcSigaAM = new Map();
  const gerais = [];
  for (const linha of siga.slice(1)) {
    const p = mapProcessoSiga((...nomes) => getSiga(linha, ...nomes));
    if (!p.protocoloSiga) continue;
    gerais.push(p);
    const am = trim(getSiga(linha, "Regulador", "REGULADOR SGA"));
    if (am) orcSigaAM.set(norm(p.protocoloSiga), am);
  }

  // BASE REGULADOR ANALISTA (NUMERO -> REGULADOR ANALISTA): casa o analista por protocolo
  const baseAnalista = new Map(), analises = [];
  { const getB = indexador(baseAna[0] || []);
    for (const linha of baseAna.slice(1)) {
      const num = norm(getB(linha, "NUMERO", "ID EXTERNO", "PROTOCOLO"));
      const an = trim(getB(linha, "REGULADOR ANALISTA"));
      const data = paraIso(getB(linha, "DATA DA ANALISE", "DATA DA ANÁLISE"));
      if (num && an) baseAnalista.set(num, an);
      if (num && an && data) analises.push({ protocolo: num, pessoa: an, data });
    } }
  const analistaDe = (p) => baseAnalista.get(norm(p.protocoloSiga)) || "";

  // BASE VISTORIA INICIAL (NUMERO = PROTOCOLO SIGA -> DATA DA ANALISE): data da vistoria inicial
  const baseVistoria = new Map(), baseVistoriaPessoa = new Map(), vistorias = [];
  { const getV = indexador(baseVis[0] || []);
    for (const linha of baseVis.slice(1)) {
      const num = norm(getV(linha, "NUMERO", "PROTOCOLO SIGA", "PROTOCOLO"));
      const dt = paraIso(getV(linha, "DATA DA ANALISE", "DATA DA REGULAGEM", "DATA"));
      if (num && dt) baseVistoria.set(num, dt);
      const pessoa = trim(getV(linha, "REGULADOR ANALISTA", "REGULADOR", "RESPONSAVEL"));
      if (num && pessoa) baseVistoriaPessoa.set(num, pessoa);
      if (num && dt) vistorias.push({ protocolo: num, pessoa, data: dt });
    } }
  const vistoriaDe = (p) => baseVistoria.get(norm(p.protocoloSiga)) || "";

  // Reguladores: aba REGULADORES (tem REGULADOR ANALISTA e REGULADOR SGA)
  const getReg = indexador(reg[0] || []);
  // orçamentista do regulador = coluna T do SGA (índice 19), guardado por protocolo
  const orcSgaColT = new Map();
  const reguladores = reg.slice(1).map((linha) => {
    const p = mapProcessoRegulador((...nomes) => getReg(linha, ...nomes));
    const t = trim(getReg(linha, "REGULADOR SGA", "Regulador"));
    if (p.protocoloSiga && t) orcSgaColT.set(norm(p.protocoloSiga), t);
    return p;
  }).filter((p) => p.protocoloSiga);

  // protocolo SIGA -> processo da aba SIGA: traz "Regulador"/AM (= orçamentista),
  // Tarefa (etapa), datas e dias em atraso — campos que a aba REGULADORES pode não ter
  const sigaPorProtocolo = new Map(), sigaPorTarefa = new Map();
  for (const p of gerais) {
    const k = norm(p.protocoloSiga);
    if (k) { if (!sigaPorProtocolo.has(k)) sigaPorProtocolo.set(k, p); sigaPorTarefa.set(k + "|" + norm(p.tarefa), p); }
  }

  // base final: tudo do gerencial que NÃO é regulador + os reguladores
  const naoReg = gerais.filter((p) => p.setor !== "REGULADORES");
  const processos = naoReg.concat(reguladores.length ? reguladores : gerais.filter((p) => p.setor === "REGULADORES"));
  const LIXO = new Set(["", "#N/A", "N/A", "#REF!", "-", "NÃO INFORMADO", "NAO INFORMADO"]);
  const limpo = (v) => { const s = trim(v); return LIXO.has(s.toUpperCase()) ? "" : s; };
  for (const p of processos) {
    p._vistoriaAnalistas = vistoriaDosAnalistas(p);
    if (p._vistoriaAnalistas) {
      p.responsavel = limpo(orcSgaColT.get(norm(p.protocoloSiga)) || '') || limpo(p.regulador);
      p.dataRegulagem = vistoriaDe(p);
      p.responsavelVistoria = baseVistoriaPessoa.get(norm(p.protocoloSiga)) || '';
    }
    // regulador analista pela BASE (NUMERO -> analista): preenche sempre (resolve coluna duplicada/vazia)
    if (!p.reguladorAnalista) p.reguladorAnalista = analistaDe(p);
    if (p.setor === "REGULADORES") {
      const k = norm(p.protocoloSiga);
      const base = sigaPorTarefa.get(k + "|" + norm(p.tarefa)) || sigaPorProtocolo.get(k);
      p.setorAtual = base ? trim(base.setor) : "";   // setor atual do processo no SIGA (p/ o BI considerar só quem ainda está com os reguladores)
      // orçamentista do regulador: SÓ coluna T do SGA ou coluna AM do SIGA (fontes confirmadas
      // pelo usuário), ignorando "Não informado"/lixo. Sem fallback por cabeçalho (trazia nome
      // errado/de outro setor). Vazio nas duas => "" => cai em "Sem orçamentista".
      p.responsavel = limpo(orcSgaColT.get(norm(p.protocoloSiga)) || "")
                   || limpo(orcSigaAM.get(norm(p.protocoloSiga)) || "");
      if (base) {
        p.porTarefa = base.porTarefa;
        p.consultor = base.consultor;
        p.consultorTecnico = base.consultorTecnico;
        if (!p.cnpj) p.cnpj = base.cnpj;
        p.campoAdicional = base.campoAdicional;
        if (!trim(p.tarefa)) p.tarefa = base.tarefa;                            // tarefa (etapa) vem da aba SIGA
        if (!p.diasAtraso) p.diasAtraso = base.diasAtraso;                      // dias em atraso (coluna O)
        if (!trim(p.diasAtrasoSiga)) p.diasAtrasoSiga = base.diasAtrasoSiga;
        if (!trim(p.dataComunicado)) p.dataComunicado = base.dataComunicado;
        if (!trim(p.dataAutorizado)) p.dataAutorizado = base.dataAutorizado;
        if (!trim(p.diasUteisAutorizado)) p.diasUteisAutorizado = base.diasUteisAutorizado;
      }
      if (!p.dataRegulagem) p.dataRegulagem = vistoriaDe(p);
      p.responsavelVistoria = baseVistoriaPessoa.get(norm(p.protocoloSiga)) || '';
    }
  }
  // Reúne dados de cada item SGA pela chave composta, sem misturar associado e terceiro.
  const getSga = indexador(sga[0] || []), itensSga = new Map(), analisesSga = [];
  const colDataAnalise = (sga[0] || []).findIndex((v) => norm(v).replace(/[^A-Z0-9]/g, '') === 'DATADAANALISEDOREGULADOR');
  for (const linha of sga.slice(1)) {
    const g = (...n) => getSga(linha, ...n);
    const k = chaveProcesso(g('PROTOCOLO'), g('TIPO EVENTO'), g('NOME TERCEIRO') || g('NOME ASSOCIADO'));
    if (k) { const a = itensSga.get(k) || []; a.push(linha); itensSga.set(k, a); }
    const pessoa = nomeValido(g('ID EXTERNO'));
    const data = colDataAnalise >= 0 ? paraIso(linha[colDataAnalise]) : '';
    if (k && pessoa && data) analisesSga.push({ protocolo: k, pessoa, data });
  }
  for (const p of processos) {
    const itens = itensSga.get(chaveProcesso(p.protocoloSga, p.cobertura, p.nome)) || [];
    if (itens.length !== 1) continue;
    const g = (...n) => getSga(itens[0], ...n);
    p.analista = trim(g('ANALISTA RESPONSAVEL', 'ANALISTA RESPONSÁVEL')) || p.analista;
    p.oficinaSga = trim(g('NOME FANTASIA OFICINA', 'NOME FANTASIA FORNECEDOR', 'NOME FORNECEDOR', 'NOME FANTASIA')) || p.oficinaSga;
    p.cnpj = trim(g('CNPJ', 'CPF/CNPJ')) || p.cnpj;
  }
  incorporarStatusSga(processos, sga);
  const distintos = (arr, campo, filtro) => [...new Set(arr.filter(filtro || (() => true)).map((p) => limpo(p[campo])).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  // setores reais, por frequência (desc)
  const contSetor = new Map();
  for (const p of processos) { const s = trim(p.setor); if (s) contSetor.set(s, (contSetor.get(s) || 0) + 1); }
  const setoresReais = [...contSetor.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  const ehAnalista = (p) => p.setor === "ANALISTAS" || p.setor === "VIDROS" || p._analistasSGA;
  // aba OFICINAS (cadastro) -> lista detalhada p/ a página de Oficinas. CNPJ = coluna E (índice 4).
  const getOfi = indexador(ofiAba[0] || []);
  const E_CNPJ = 4;
  const oficinas = ofiAba.slice(1).map((linha) => {
    const g = (...n) => getOfi(linha, ...n);
    const nome = limpo(g("Nome", "Razão social", "Razao social"));
    const fantasia = limpo(g("Nome fantasia", "Nome Fantasia", "Fantasia"));
    return {
      nome, fantasia, oficina: fantasia || nome,
      cnpj: cnpjFmt(trim(linha[E_CNPJ] == null ? "" : linha[E_CNPJ]) || g("Cpf/cnpj", "CPF/CNPJ", "CNPJ", "CPF")),
      telefone: limpo(g("Telefone", "Fone", "Celular")),
      email: limpo(g("E-mail contato", "Email contato", "E-mail", "Email")),
      cep: limpo(g("Cep", "CEP")),
      logradouro: limpo(g("Logradouro", "Endereço", "Endereco")),
      numero: limpo(g("Nº", "N°", "Numero", "Número")),
      complemento: limpo(g("Complemento")),
      bairro: limpo(g("Bairro")),
      cidade: limpo(g("Cidade")),
      uf: limpo(g("Estado", "UF")).toUpperCase(),
      segmento: limpo(g("Segmento")),
      site: limpo(g("Site", "Website")),
      situacao: limpo(g("Situação", "Situacao", "Status")).toUpperCase(),
      consultor: limpo(g("Consultor Técnico", "Consultor Tecnico", "Consultor", "Contato")),
    };
  }).filter((o) => o.nome || o.fantasia || o.cnpj);

  const doc = (v) => trim(v).replace(/\D/g, "");
  const oficinasPorDoc = new Map();
  for (const o of oficinas) { const k = doc(o.cnpj); if (k) { const a = oficinasPorDoc.get(k) || []; a.push(o); oficinasPorDoc.set(k, a); } }
  const contados = new Set();
  for (const p of processos) {
    const candidatas = oficinasPorDoc.get(doc(p.cnpj)) || [];
    if (candidatas.length === 1) {
      p.consultorTecnico = candidatas[0].consultor;
      const chave = doc(p.cnpj) + '|' + (p.protocoloSiga || p.protocoloSga);
      if (!contados.has(chave)) { contados.add(chave); candidatas[0].quantidade = (candidatas[0].quantidade || 0) + 1; }
    } else if (doc(p.cnpj)) p.consultorTecnico = "";
  }
  const listas = {
    analistas: distintos(processos, "analista", (p) => ehAnalista(p) && !p._analistasSGA),
    reguladores: distintos(processos, "responsavel", (p) => p.setor === "REGULADORES"),
    reguladoresAnalistas: distintos(processos, "reguladorAnalista", (p) => p.setor === "REGULADORES"),
    consultores: distintos(processos, "consultorTecnico", (p) => (p.porTarefa === "CONSULTORES" || (!p.porTarefa && p.setor === "CONSULTORES")) && p.evento !== "VIDROS"),
    marcas: distintos(processos, "marca"),
    eventos: distintos(processos, "evento"),
    cooperativas: distintos(processos, "cooperativa"),
    situacoes: [], concluido: "Concluído",
    statusReg: ["Em regulação", "Regularizado", "Negado"],
    oficinas,
    setores: setoresReais.length ? setoresReais : ["ANALISTAS", "VIDROS", "REGULADORES", "CONSULTORES"],
  };
  const registrado = trim(atualizacao[1]?.[1]);
  const dataRegistro = registrado ? new Date(registrado) : null;
  const gerado = dataRegistro && !Number.isNaN(dataRegistro.valueOf())
    ? { iso: dataRegistro.toISOString(), br: dataRegistro.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }) }
    : { iso: '', br: 'Não informado' };
  return { processos, listas, gerado, analises: analisesSga.length ? analisesSga : analises, vistorias };
}

/* ----------------------------------------------------------- gravação (Fase 2): Data da Vistoria Inicial */
// writes = [{ protocolo (SIGA), dataIso }]. Grava na aba BASE VISTORIA INICIAL do gerencial
// (coluna DATA DA ANALISE), casando por NUMERO = PROTOCOLO SIGA. Atualiza a linha ou cria uma nova.
export async function salvarVistoria(cfg, writes, opts = {}) {
  const { saJson, sheetSinistro } = cfg;
  const ABA = "BASE VISTORIA INICIAL";
  if (!Array.isArray(writes) || !writes.length) return { ok: true, atualizados: 0, criados: 0 };
  // dry-run usa escopo de leitura (não grava); real usa escopo de escrita
  const token = await obterToken(saJson, opts.dryRun ? undefined : "https://www.googleapis.com/auth/spreadsheets");
  const tabela = await lerAba(token, sheetSinistro, ABA);
  const header = tabela[0] && tabela[0].length ? tabela[0] : ["NUMERO", "REGULADOR ANALISTA", "DATA DA ANALISE"];
  const colNum = acharCol(header, ["NUMERO", "PROTOCOLO SIGA", "PROTOCOLO"]);
  const colData = acharCol(header, ["DATA DA ANALISE", "DATA DA REGULAGEM", "DATA"]);
  const colResponsavel = acharCol(header, ["REGULADOR ANALISTA", "REGULADOR", "RESPONSAVEL"]);
  if (colNum < 0 || colData < 0 || colResponsavel < 0) throw new Error('A base de vistoria não tem as colunas de número, data e responsável esperadas.');
  const linhaDe = new Map();
  for (let i = 1; i < tabela.length; i++) { const n = norm((tabela[i] || [])[colNum]); if (n && !linhaDe.has(n)) linhaDe.set(n, i + 1); }
  const q = (aba) => "'" + aba.replace(/'/g, "''") + "'";
  const dataColLetra = colLetra(colData);

  const updates = [], novos = [];
  for (const w of writes) {
    const prot = trim(w.protocolo); if (!prot) continue;
    const br = w.dataIso == null ? null : isoParaBr(w.dataIso);
    const row = linhaDe.get(norm(prot));
    if (row) {
      if (br != null) updates.push({ range: `${q(ABA)}!${dataColLetra}${row}`, values: [[br]] });
      if (w.responsavel != null) updates.push({ range: `${q(ABA)}!${colLetra(colResponsavel)}${row}`, values: [[trim(w.responsavel)]] });
    } else {
      const nova = new Array(header.length).fill(""); nova[colNum] = prot;
      if (br != null) nova[colData] = br;
      if (w.responsavel != null) nova[colResponsavel] = trim(w.responsavel);
      novos.push(nova);
    }
  }
  if (opts.dryRun) {
    return { ok: true, dryRun: true, colNum, colData, dataColLetra, totalLinhas: tabela.length - 1,
             updates: updates.map((u) => u.range + " = " + u.values[0][0]), criariaLinhas: novos.length, novos: novos.map((n) => n.join("|")) };
  }
  if (updates.length) {
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetSinistro}/values:batchUpdate`, {
      method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" },
      body: JSON.stringify({ valueInputOption: "USER_ENTERED", data: updates }),
    });
    const j = await r.json(); if (j.error) throw new Error("gravação (update): " + j.error.message);
  }
  if (novos.length) {
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetSinistro}/values/${encodeURIComponent(ABA)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
      method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" },
      body: JSON.stringify({ values: novos }),
    });
    const j = await r.json(); if (j.error) throw new Error("gravação (append): " + j.error.message);
  }
  return { ok: true, atualizados: updates.length, criados: novos.length };
}

export const _internos = { paraIso, isoParaBr, paraNumero, sinais, indexador, acharCol, colLetra, mapProcessoSiga };
