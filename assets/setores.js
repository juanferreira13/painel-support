/* ------------------------------------------------------------------------- *
 * setores.js — configuração de cada setor (analistas, reguladores, consultores)
 *
 * Metadados, campos editáveis do preenchimento (espelhando as colunas manuais
 * das planilhas) e colunas da lista dos dashboards. Consumido pelos
 * renderizadores genéricos em app.js.
 * ------------------------------------------------------------------------- */
(function () {
  "use strict";
  const GS = (window.GS = window.GS || {});

  // Colunas comuns de lista (reaproveitadas)
  const COL_DIAS = { rot: "Dias", key: "diasAberto", classe: "num" };
  const COL_SIGA = { rot: "Status SIGA", key: "statusSiga", classe: "fixo" };
  const COL_SGA = { rot: "Status SGA", key: "statusSga", classe: "fixo", difere: true };

  GS.SETORES = {
    sinistro: {
      chave: "sinistro",
      rotulo: "Sinistro",
      etiqueta: "Sinistro",
      icone: "sinistro",
      tituloDash: "Dashboard do sinistro",
      aba: "GERENCIAL SINISTRO",
      ledeDash: "Visão geral de todos os eventos do sinistro, lado a lado com a situação no SIGA e no SGA. Os três setores — analistas, reguladores e consultores — saem daqui.",
      modelo: "geral",
      // 28 colunas na ordem/nomes exatos pedidos para o BI
      colunas: [
        { rot: "Competência", key: "competencia", classe: "fixo", tipo: "mes" },
        { rot: "PROTOCOLO SIGA", key: "protocoloSiga", classe: "fixo" },
        { rot: "Cobertura", key: "cobertura", classe: "fixo" },
        { rot: "Evento", key: "evento", classe: "fixo" },
        { rot: "Nome", key: "nome" },
        { rot: "Veículo", key: "veiculo", classe: "fixo" },
        { rot: "Tarefa", key: "tarefa", classe: "fixo" },
        { rot: "Oficina", key: "oficina" },
        { rot: "ANALISTA", key: "analista" },
        { rot: "DATA COMUNICADO EVENTO", key: "dataComunicado", classe: "fixo", tipo: "data" },
        { rot: "DIAS UTEIS COMUNICADO", key: "diasUteisComunicado", classe: "num" },
        { rot: "DATA AUTORIZADO", key: "dataAutorizado", classe: "fixo", tipo: "data" },
        { rot: "DIAS UTEIS AUTORIZADO", key: "diasUteisAutorizado", classe: "num" },
        { rot: "PLACA SGA", key: "placaSga", classe: "fixo" },
        { rot: "ESTADO", key: "uf", classe: "fixo" },
        { rot: "STATUS SGA", key: "statusSga", classe: "fixo", difere: true },
        { rot: "PROTOCOLO SGA", key: "protocoloSga", classe: "fixo" },
        { rot: "STATUS SIGA", key: "statusSiga", classe: "fixo" },
        { rot: "CLASSIFICAÇÃO NEGATIVA", key: "classif" },
        { rot: "MÊS REF SIGA", key: "mesRefSiga", classe: "fixo" },
        { rot: "OFICINA SGA", key: "oficinaSga" },
        { rot: "Regulador", key: "regulador" },
        { rot: "VOLUNTARIO", key: "voluntario" },
        { rot: "COOPERATIVA", key: "cooperativa", classe: "fixo" },
        { rot: "PARTICIPAÇÃO", key: "participacao", classe: "num", tipo: "moeda" },
        { rot: "REGULADOR ANALISTA", key: "reguladorAnalista" },
        { rot: "CIDADE", key: "cidade", classe: "fixo" },
        { rot: "DATA EVENTO", key: "dataEvento", classe: "fixo", tipo: "data" },
      ],
    },

    analistas: {
      chave: "analistas",
      rotulo: "Analistas",
      etiqueta: "Analistas",
      icone: "analistas",
      tituloDash: "Dashboard dos analistas",
      tituloForm: "Preenchimento — Analistas",
      aba: "ANALISTAS / VIDROS",
      ledeDash: "Processos das listas ANALISTAS e VIDROS do sinistro. A situação, a próxima ação e o prazo vêm do preenchimento da equipe; o painel mostra o que está em dia, atrasado e o que falta preencher.",
      ledeForm: "Informe a situação, a próxima ação e o prazo de cada processo. O que você muda fica marcado como não salvo até enviar.",
      pessoas: "analistas",
      modelo: "pendencia",      // PREENCHER / ATRASADO / EM DIA / CONCLUÍDO
      pessoaCampo: "analista",  // coluna de pessoa (vazio = responsável no SIGA)
      // campos editáveis (preenchimento) — refletem PARTICIPAÇÃO, OBSERVAÇÃO + acompanhamento
      campos: [
        { id: "analista", rot: "Analista", tipo: "select", fonte: "analistas", vazio: "Responsável no SIGA" },
        { id: "situacao", rot: "Situação", tipo: "select", fonte: "situacoes", vazio: "Escolha a situação" },
        { id: "proxima", rot: "Próxima ação", tipo: "text", ph: "O que falta fazer" },
        { id: "prazo", rot: "Prazo", tipo: "date" },
        { id: "participacao", rot: "Participação (R$)", tipo: "numero" },
        { id: "obs", rot: "Observação", tipo: "textarea", largo: true, ph: "Anotações do processo" },
      ],
      colunas: [
        { rot: "Protocolo SIGA", key: "protocoloSiga", classe: "fixo" },
        { rot: "Protocolo SGA", key: "protocoloSga", classe: "fixo" },
        { rot: "Nome", key: "nome" },
        { rot: "Placa", key: "placaSiga", classe: "fixo" },
        { rot: "Cobertura", key: "cobertura", classe: "fixo" },
        { rot: "Evento", key: "evento", classe: "fixo" },
        { rot: "Analista", key: "analistaEff" },
        { rot: "Consultor", key: "consultor" },
        { rot: "Cooperativa", key: "cooperativa", classe: "fixo" },
        { rot: "Participação", key: "participacao", classe: "num", tipo: "moeda" },
        { rot: "Data autorizado", key: "dataAutorizado", classe: "fixo", tipo: "data" },
        { rot: "Classif. negativa", key: "classif" },
        COL_DIAS, COL_SIGA, COL_SGA,
      ],
    },

    reguladores: {
      chave: "reguladores",
      rotulo: "Reguladores",
      etiqueta: "Reguladores",
      icone: "reguladores",
      tituloDash: "Dashboard dos reguladores",
      tituloForm: "Preenchimento — Reguladores",
      aba: "REGULADORES / VISTORIA INICIAL",
      ledeDash: "Processos do setor REGULADORES: regulação de sinistros, vistoria inicial e negativas. Acompanhe por regulador orçamentista e regulador analista, o que está em regulação, o que foi regularizado e os negados em aberto.",
      ledeForm: "Informe a data da vistoria inicial de cada processo — o único campo que não existe no SGA. O que você muda fica marcado como não salvo até enviar.",
      pessoas: "reguladores",
      modelo: "regulacao",       // usa statusRegulacao
      pessoaCampo: "responsavel",            // regulador orçamentista (quem fez a vistoria/orçamento)
      rotuloPessoa: "Reg. orçamentista",
      analistaCampo: "reguladorAnalista",    // regulador analista (casado por ID EXTERNO no integrador)
      temMatriz: true,
      // único setor que mantém preenchimento (os demais atualizam só o SGA).
      // Fase 2: só a Data da Vistoria Inicial — é o único campo sem lugar no SGA e
      // o único com destino real na planilha (aba BASE VISTORIA INICIAL, via /api/salvar).
      campos: [
        { id: "dataRegulagem", rot: "Data da vistoria inicial", tipo: "date" },
      ],
      colunas: [
        { rot: "Protocolo SIGA", key: "protocoloSiga", classe: "fixo" },
        { rot: "Protocolo SGA", key: "protocoloSga", classe: "fixo" },
        { rot: "Nome", key: "nome" },
        { rot: "Placa", key: "placaSiga", classe: "fixo" },
        { rot: "Tarefa", key: "tarefa", classe: "fixo" },
        { rot: "Reg. orçamentista", key: "responsavel" },
        { rot: "Reg. analista", key: "reguladorAnalista" },
        { rot: "Cidade", key: "cidade", classe: "fixo" },
        { rot: "Oficina", key: "oficina" },
        { rot: "Status regulação", key: "statusRegulacao" },
        { rot: "Vistoria inicial", key: "dataRegulagem", classe: "fixo", tipo: "data", editavel: true },
        { rot: "DATA AUTORIZADO", key: "dataAutorizado", classe: "fixo", tipo: "data" },
        { rot: "Dias atraso SIGA", key: "diasAtrasoSiga", classe: "num" },
        { rot: "Dias úteis autoriz.", key: "diasUteisAutorizado", classe: "num" },
        { rot: "Classif. negativa", key: "classif" },
        { rot: "Mês ref.", key: "mesReferencia", classe: "fixo" },
        COL_DIAS, COL_SIGA, COL_SGA,
      ],
    },

    consultores: {
      chave: "consultores",
      rotulo: "Consultores",
      etiqueta: "Consultores",
      icone: "consultores",
      tituloDash: "Dashboard dos consultores técnicos",
      tituloForm: "Preenchimento — Consultores técnicos",
      aba: "CONSULTORES TEC. / Oficinas",
      ledeDash: "Processos do setor CONSULTORES: vistorias técnicas, negociação com oficinas e liberação de peças. Acompanhe por consultor e a rede de oficinas homologadas.",
      ledeForm: "Informe o consultor técnico, a situação e a próxima ação de cada processo. O que você muda fica marcado como não salvo até enviar.",
      pessoas: "consultores",
      modelo: "pendencia",
      pessoaCampo: "consultorTecnico",
      temOficinas: true,
      campos: [
        { id: "consultorTecnico", rot: "Consultor técnico", tipo: "select", fonte: "consultores", vazio: "Não encontrado" },
        { id: "situacao", rot: "Situação", tipo: "select", fonte: "situacoes", vazio: "Escolha a situação" },
        { id: "proxima", rot: "Próxima ação", tipo: "text", ph: "O que falta fazer" },
        { id: "prazo", rot: "Prazo", tipo: "date" },
        { id: "obs", rot: "Observação", tipo: "textarea", largo: true, ph: "Anotações do processo" },
      ],
      colunas: [
        { rot: "Protocolo SIGA", key: "protocoloSiga", classe: "fixo" },
        { rot: "Protocolo SGA", key: "protocoloSga", classe: "fixo" },
        { rot: "Nome", key: "nome" },
        { rot: "Placa", key: "placaSiga", classe: "fixo" },
        { rot: "Oficina", key: "oficina" },
        { rot: "Consultor", key: "consultorEff" },
        { rot: "Situação", key: "situacao" },
        { rot: "Prazo", key: "prazo", classe: "fixo", tipo: "data" },
        COL_DIAS, COL_SIGA, COL_SGA,
      ],
    },
  };

  GS.ORDEM_SETORES = ["analistas", "reguladores", "consultores"];        // setores com dashboard de equipe
  GS.ORDEM_PREENCHIMENTO = [];                                           // sem aba de preenchimento: a Data da Vistoria Inicial é editada no próprio dashboard dos reguladores
  GS.DASH_ORDEM = ["sinistro", "analistas", "reguladores", "consultores"];   // ordem dos dashboards
})();
