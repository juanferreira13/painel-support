/* ------------------------------------------------------------------------- *
 * dados.js — camada de dados
 *
 * HOJE: dados de DEMONSTRAÇÃO gerados aqui, com as MESMAS colunas das planilhas
 * reais (abas ANALISTAS/VIDROS, REGULADORES, CONSULTORES TEC. do sinistro).
 *
 * DEPOIS (após validação do grupo support): trocar `carregar()` por uma chamada
 * `fetch('/api/dados?setor=...')` a uma função serverless que lê o Google Sheets
 * com a conta de serviço (GOOGLE_CREDENCIAIS) do lado do servidor. O resto do
 * site não muda: as telas só consomem o que `GS.DB.carregar(chave)` devolve.
 * O envio do preenchimento vira `fetch('/api/salvar', { method:'POST', ... })`.
 * ------------------------------------------------------------------------- */
(function () {
  "use strict";
  const GS = (window.GS = window.GS || {});

  // Marca a origem dos dados (o selo no topo mostra isto).
  GS.FONTE = { tipo: "demo", rotulo: "Dados de demonstração", live: false };

  /* ----------------------------------------------------------- PRNG com semente (estável entre recargas) */
  function rng(semente) {
    let s = semente >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  const R = rng(20260311);
  const escolha = (arr) => arr[Math.floor(R() * arr.length)];
  const inteiro = (a, b) => a + Math.floor(R() * (b - a + 1));
  const chance = (p) => R() < p;

  /* ----------------------------------------------------------- vocabulário (fictício) */
  const NOMES = ["Ana", "Bruno", "Carla", "Diego", "Eduardo", "Fernanda", "Gustavo", "Helena", "Igor", "Juliana",
    "Lucas", "Mariana", "Nelson", "Patrícia", "Rafael", "Sabrina", "Thiago", "Vanessa", "Wagner", "Yasmin",
    "André", "Beatriz", "Caio", "Débora", "Felipe", "Gabriela", "Henrique", "Isabela", "João", "Larissa"];
  const SOBRENOMES = ["Silva", "Santos", "Oliveira", "Souza", "Lima", "Pereira", "Costa", "Almeida", "Nunes", "Rocha",
    "Ferreira", "Gomes", "Martins", "Araújo", "Ribeiro", "Carvalho", "Teixeira", "Barbosa", "Moraes", "Correia"];
  const CIDADES = [["São Paulo", "SP"], ["Campinas", "SP"], ["Rio de Janeiro", "RJ"], ["Belo Horizonte", "MG"],
    ["Curitiba", "PR"], ["Porto Alegre", "RS"], ["Salvador", "BA"], ["Goiânia", "GO"], ["Fortaleza", "CE"],
    ["Londrina", "PR"], ["Uberlândia", "MG"], ["Sorocaba", "SP"], ["Joinville", "SC"], ["Vitória", "ES"]];
  const COBERTURAS = ["Colisão", "Roubo/Furto", "Incêndio", "Terceiros", "Vidros", "Assistência", "Perda total", "Fenômenos naturais"];
  const EVENTOS_ANALISTA = ["COLISÃO", "AVARIA", "FURTO", "TERCEIROS", "PEQUENOS REPAROS", "GUINCHO"];
  const TAREFAS_ANALISTA = ["Análise de documentos", "Autorização de reparo", "Conferência de orçamento", "Acompanhamento de reparo", "Encerramento"];
  const TAREFAS_CONSULTOR = ["Vistoria técnica", "Negociação com oficina", "Reavaliação de orçamento", "Liberação de peças"];
  const TAREFAS_REGULADOR = ["Regulação de sinistro", "Vistoria inicial", "Análise de negativa", "Parecer técnico"];
  const OFICINAS = [
    ["Auto Center Primavera", "SP"], ["Mecânica Boa Vista", "SP"], ["Funilaria Horizonte", "RJ"], ["Oficina Vale Verde", "MG"],
    ["Centro Automotivo Alfa", "PR"], ["Repara Car", "RS"], ["Pit Stop Sul", "SC"], ["Garagem Central", "BA"],
    ["Auto Reparo Líder", "GO"], ["Oficina Nova Era", "SP"], ["Multi Car Serviços", "CE"], ["Super Auto Peças", "ES"]];
  const STATUS_SGA = ["EM ANDAMENTO", "AUTORIZADO", "NEGADO", "FINALIZADO", "AGUARDANDO"];
  const STATUS_SIGA = ["EM ANÁLISE", "AUTORIZADO", "LIBERADO", "ARQUIVADO", "NEGADO", "AGUARDANDO"];
  const CLASSIF_NEG = ["Fora de cobertura", "Carência não cumprida", "Documentação pendente", "Veículo irregular",
    "Indícios de fraude", "Sem direito ao benefício"];
  const SITUACOES = ["Aguardando documentos", "Em análise", "Aguardando orçamento", "Aguardando vistoria",
    "Em negociação", "Aguardando autorização", "Concluído"];
  const CONCLUIDO = "Concluído";
  const STATUS_REG = ["Em regulação", "Aguardando vistoria", "Regularizado", "Negado", "Em análise de negativa"];

  const ANALISTAS = ["Ana Martins", "Bruno Costa", "Carla Souza", "Diego Lima", "Fernanda Rocha", "Gustavo Alves", "Patrícia Nunes", "Rafael Dias"];
  const REGULADORES = ["Helena Prado", "Igor Mendes", "Juliana Reis", "Nelson Faria", "Sabrina Melo", "Thiago Barros"];      // orçamentistas
  const REG_ANALISTAS = ["Marcos Vinícius", "Tânia Lopes", "Priscila Amaral", "Otávio Brandão", "Renata Vilela"];           // reguladores analistas (ID EXTERNO)
  const CONSULTORES = ["Caio Ferreira", "Débora Ramos", "Felipe Araújo", "Larissa Gomes", "Wagner Pinto"];

  // veículos (marca -> modelos), eventos e cooperativas — alimentam os gráficos do gerencial
  const VEICULOS = [
    ["FIAT", ["Argo", "Mobi", "Strada", "Toro", "Cronos", "Uno", "Pulse"]],
    ["VOLKSWAGEN", ["Gol", "Polo", "T-Cross", "Nivus", "Virtus", "Saveiro"]],
    ["CHEVROLET", ["Onix", "Onix Plus", "Tracker", "S10", "Spin", "Montana"]],
    ["FORD", ["Ka", "Ranger", "EcoSport"]],
    ["HYUNDAI", ["HB20", "Creta", "HB20S"]],
    ["TOYOTA", ["Corolla", "Hilux", "Yaris", "Corolla Cross"]],
    ["HONDA", ["Civic", "HR-V", "Fit", "City"]],
    ["RENAULT", ["Kwid", "Sandero", "Duster", "Logan"]],
    ["JEEP", ["Renegade", "Compass"]],
    ["NISSAN", ["Kicks", "Versa"]],
  ];
  const EVENTOS_NV = ["COLISÃO", "AVARIA", "FURTO/ROUBO", "TERCEIROS", "INCÊNDIO", "FENÔMENOS NATURAIS", "PEQUENOS REPAROS", "GUINCHO", "PERDA TOTAL"];
  const COOPERATIVAS = ["Coop. Central", "Coop. Sul", "Coop. Norte", "Coop. Leste", "Coop. Oeste", "Coop. Vale", "Coop. Litoral"];

  const pessoaNome = () => `${escolha(NOMES)} ${escolha(SOBRENOMES)}`;
  const placa = () => {
    const L = "ABCDEFGHIJKLMNPQRSTUVWXYZ";
    const l = () => L[Math.floor(R() * L.length)];
    const d = () => Math.floor(R() * 10);
    return `${l()}${l()}${l()}${d()}${l()}${d()}${d()}`;
  };
  function dataEntre(diasAtrasMax, diasAtrasMin) {
    const d = new Date();
    d.setDate(d.getDate() - inteiro(diasAtrasMin || 0, diasAtrasMax));
    return GS.isoDia(d);
  }
  function competencia(abertura) { return abertura.slice(0, 7); }
  const prazoFuturo = () => GS.isoDia(new Date(Date.now() + inteiro(1, 25) * 864e5));   // em dia
  const prazoPassado = () => GS.isoDia(new Date(Date.now() - inteiro(5, 40) * 864e5));   // atrasado

  /* ----------------------------------------------------------- gera a base de processos */
  let contador = 20250000;
  function novoProcesso(setor) {
    const [cidade, uf] = escolha(CIDADES);
    const abertura = dataEntre(420, 2);
    const diasAberto = GS.diasEntre(abertura, GS.HOJE);
    const statusSiga = escolha(STATUS_SIGA);
    let statusSga = chance(0.12) ? "" : escolha(STATUS_SGA);
    // às vezes diverge de propósito (alimenta a matriz SIGA x SGA)
    if (chance(0.55) && statusSga) statusSga = statusSiga === "NEGADO" ? "NEGADO" : (statusSiga === "AUTORIZADO" ? "AUTORIZADO" : statusSga);
    const negado = statusSiga === "NEGADO" || statusSga === "NEGADO";
    const num = "SIG-" + (++contador);
    const [marca, modelos] = escolha(VEICULOS);
    const p = {
      setor,
      protocoloSiga: num,
      protocoloSga: chance(0.1) ? "" : "SGA-" + inteiro(100000, 999999),
      nome: pessoaNome(),
      cobertura: escolha(COBERTURAS),
      evento: setor === "VIDROS" ? "VIDROS" : escolha(EVENTOS_NV),
      marca,
      modelo: escolha(modelos),
      cooperativa: escolha(COOPERATIVAS),
      placaSiga: placa(),
      abertura,
      diasAberto,
      competencia: competencia(abertura),
      responsavel: setor === "REGULADORES" ? escolha(REGULADORES) : setor === "CONSULTORES" ? escolha(CONSULTORES) : escolha(ANALISTAS),
      reguladorAnalista: setor === "REGULADORES" ? (chance(0.18) ? "" : escolha(REG_ANALISTAS)) : "",
      cidade, uf,
      dataComunicado: chance(0.9) ? dataEntre(diasAberto, Math.max(0, diasAberto - 3)) : "",
      dataAutorizado: statusSiga === "AUTORIZADO" || statusSiga === "LIBERADO" ? dataEntre(Math.max(1, diasAberto - 5)) : "",
      statusSga, statusSiga,
      classif: negado ? escolha(CLASSIF_NEG) : "",
      oficina: setor === "CONSULTORES" || chance(0.4) ? escolha(OFICINAS)[0] : "",
      participacao: chance(0.5) ? inteiro(0, 30) * 100 : 0,
      // colunas manuais (preenchidas pela equipe) — algumas já vêm preenchidas na demo
      analista: "", situacao: "", proxima: "", prazo: "", obs: "",
      regularizadoPor: "", dataRegulagem: "", mesReferencia: "", statusRegulacao: "",
      consultorTecnico: "",
    };
    return p;
  }

  // Preenche parte das colunas manuais por setor, para os dashboards parecerem vivos.
  function semear(p) {
    const pre = chance(0.72); // ~72% já preenchidos; o resto fica "a preencher"
    if (p.setor === "ANALISTAS" || p.setor === "VIDROS") {
      if (chance(0.5)) p.analista = escolha(ANALISTAS);
      if (pre) {
        p.situacao = escolha(SITUACOES);
        if (p.situacao !== CONCLUIDO) {
          p.proxima = escolha(["Solicitar documentos", "Agendar vistoria", "Revisar orçamento", "Contatar associado", "Enviar para autorização"]);
          p.prazo = chance(0.35) ? prazoPassado() : prazoFuturo();
        }
      }
      if (chance(0.3)) p.obs = escolha(["Associado ciente.", "Aguardando retorno da oficina.", "Documentação parcial.", "Caso reaberto."]);
    } else if (p.setor === "REGULADORES") {
      p.statusRegulacao = escolha(STATUS_REG);
      if (pre && p.statusRegulacao === "Regularizado") {
        p.regularizadoPor = escolha(REGULADORES);
        p.dataRegulagem = dataEntre(Math.max(1, p.diasAberto - 5));
        p.mesReferencia = p.dataRegulagem.slice(5, 7) + "/" + p.dataRegulagem.slice(0, 4);
      }
      if (chance(0.3)) p.obs = escolha(["Vistoria inicial realizada.", "Negativa em análise.", "Aguardando laudo.", "Regulação concluída."]);
    } else if (p.setor === "CONSULTORES") {
      if (chance(0.6)) p.consultorTecnico = escolha(CONSULTORES);
      if (pre) {
        p.situacao = escolha(SITUACOES);
        if (p.situacao !== CONCLUIDO) {
          p.proxima = escolha(["Agendar vistoria técnica", "Negociar com oficina", "Reavaliar orçamento", "Liberar peças"]);
          p.prazo = chance(0.3) ? prazoPassado() : prazoFuturo();
        }
      }
      if (chance(0.3)) p.obs = escolha(["Oficina homologada.", "Peça em falta.", "Orçamento revisado.", "Vistoria agendada."]);
    }
    // quem atualizou (quando há preenchimento)
    if (p.situacao || p.regularizadoPor || p.consultorTecnico || p.obs) {
      p.atualizadoEm = dataEntre(40) + "T" + String(inteiro(8, 18)).padStart(2, "0") + ":" + String(inteiro(0, 59)).padStart(2, "0");
      p.atualizadoPor = escolha([...ANALISTAS, ...REGULADORES, ...CONSULTORES]);
    } else { p.atualizadoEm = ""; p.atualizadoPor = ""; }
    return p;
  }

  const BASE = [];
  const pesoSetor = [["ANALISTAS", 70], ["VIDROS", 18], ["REGULADORES", 48], ["CONSULTORES", 40]];
  for (const [setor, n] of pesoSetor) for (let i = 0; i < n; i++) BASE.push(semear(novoProcesso(setor)));

  /* ----------------------------------------------------------- oficinas (aba dos consultores) */
  const OFICINAS_TAB = OFICINAS.map(([nome]) => {
    const vagas = inteiro(3, 12);
    const emUso = inteiro(0, vagas);
    const [cidade, uf] = escolha(CIDADES);
    return {
      oficina: nome, cnpj: `${inteiro(10, 99)}.${inteiro(100, 999)}.${inteiro(100, 999)}/0001-${inteiro(10, 99)}`,
      consultor: escolha(CONSULTORES), cidade, uf,
      situacao: chance(0.85) ? "ATIVA" : "SUSPENSA", vagas, quantidade: emUso, disponiveis: vagas - emUso,
    };
  });

  /* ----------------------------------------------------------- "última atualização" */
  const d = new Date();
  GS.GERADO = { iso: GS.isoDia(d) + "T08:00", br: GS.dataBr(GS.isoDia(d)) + " 08:00" };

  /* ----------------------------------------------------------- API de acesso aos dados */
  const GRUPOS = {
    sinistro: () => true,   // visão geral: todos os processos
    analistas: (p) => p.setor === "ANALISTAS" || p.setor === "VIDROS",
    reguladores: (p) => p.setor === "REGULADORES",
    consultores: (p) => p.setor === "CONSULTORES",
  };

  // Overlay persistente (localStorage): o que o preenchimento SALVA fica aqui e os
  // dashboards passam a refletir — demonstra o ciclo "preenchimento -> dados -> painel"
  // já no visual. Amanhã, este overlay é substituído pela gravação no Google Sheets.
  const CHAVE_VALORES = "gs-sinistro:valores";
  function lerOverlay() {
    try { const o = JSON.parse(localStorage.getItem(CHAVE_VALORES) || "{}"); return o && typeof o === "object" ? o : {}; }
    catch (_) { return {}; }
  }
  function aplicarOverlay(p, overlay) {
    const v = overlay[p.protocoloSiga];
    if (v) for (const k in v) p[k] = v[k];
    return p;
  }

  const LISTAS_DEMO = { analistas: ANALISTAS, reguladores: REGULADORES, reguladoresAnalistas: REG_ANALISTAS, consultores: CONSULTORES, situacoes: SITUACOES,
    concluido: CONCLUIDO, statusReg: STATUS_REG, oficinas: OFICINAS_TAB,
    marcas: VEICULOS.map((v) => v[0]), eventos: ["VIDROS", ...EVENTOS_NV], cooperativas: COOPERATIVAS,
    setores: ["ANALISTAS", "VIDROS", "REGULADORES", "CONSULTORES"] };

  // Fonte ao vivo: /api/dados lê o Google Sheets (conta de serviço). Sem /api
  // configurado (ou offline), cai para os dados de demonstração — as telas não mudam.
  let LIVE = null;          // {processos, listas, gerado} = ao vivo; false = demo; null = ainda não decidido
  let promessaFonte = null;
  function garantirFonte() {
    if (LIVE !== null) return Promise.resolve(LIVE);
    if (promessaFonte) return promessaFonte;
    promessaFonte = (async () => {
      try {
        const r = await fetch("/api/dados?setor=sinistro", { headers: { accept: "application/json" } });
        if (!r.ok) throw new Error("http " + r.status);
        const j = await r.json();
        if (!j || j.configurado === false || !Array.isArray(j.processos)) throw new Error("sem dados ao vivo");
        LIVE = { processos: j.processos, listas: Object.assign({}, LISTAS_DEMO, j.listas || {}), gerado: j.gerado || GS.GERADO };
        GS.FONTE = j.fonte || { tipo: "sheets", rotulo: "Dados ao vivo (Sheets)", live: true };
        if (j.gerado) GS.GERADO = j.gerado;
        GS.DB.listas = LIVE.listas;
        if (typeof GS.aoMudarFonte === "function") GS.aoMudarFonte();
      } catch (_) {
        LIVE = false;         // mantém o demo
      }
      return LIVE;
    })();
    return promessaFonte;
  }

  GS.DB = {
    fonte: GS.FONTE,
    listas: LISTAS_DEMO,
    garantir: garantirFonte,
    async carregar(chave) {
      const live = await garantirFonte();
      const filtro = GRUPOS[chave] || (() => true);
      const overlay = lerOverlay();
      const fonte = live ? live.processos : BASE;
      const processos = fonte.filter(filtro).map((p) => aplicarOverlay(Object.assign({}, p), overlay));
      return { chave, processos, gerado: GS.GERADO, fonte: GS.FONTE, listas: GS.DB.listas };
    },
    // Grava o preenchimento. Ao vivo: POST /api/salvar (grava a Data da Vistoria
    // Inicial no Sheets). Demo: só o overlay local. Sempre reflete no overlay.
    async salvarValores(registros) {
      const o = lerOverlay();
      for (const r of registros) { (o[r.protocolo] = o[r.protocolo] || {})[r.campo] = r.valor; }
      try { localStorage.setItem(CHAVE_VALORES, JSON.stringify(o)); } catch (_) { /* sem persistência */ }
      if (LIVE) {
        try {
          const resp = await fetch("/api/salvar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ registros }) });
          const j = await resp.json().catch(() => ({}));
          if (!resp.ok) return { ok: false, total: registros.length, erro: (j && j.erro) || ("http " + resp.status) };
          return { ok: true, total: registros.length, sheets: j };
        } catch (e) {
          return { ok: false, total: registros.length, erro: String((e && e.message) || e) };
        }
      }
      return { ok: true, total: registros.length };
    },
    // Resumo para o hero. Chame depois de garantir() (o início aguarda a fonte).
    resumo() {
      const overlay = lerOverlay();
      const lista = (LIVE ? LIVE.processos : BASE).map((p) => aplicarOverlay(Object.assign({}, p), overlay));
      const total = lista.length;
      const porSetor = { analistas: lista.filter(GRUPOS.analistas).length, reguladores: lista.filter(GRUPOS.reguladores).length, consultores: lista.filter(GRUPOS.consultores).length };
      const aPreencher = LIVE ? 0 : lista.filter((p) => GRUPOS.analistas(p) || GRUPOS.consultores(p)).filter((p) => !GS.norm(p.situacao)).length;
      const negados = lista.filter((p) => p.statusSiga === "NEGADO" || p.statusSga === "NEGADO").length;
      return { total, porSetor, aPreencher, negados };
    },
  };
})();
