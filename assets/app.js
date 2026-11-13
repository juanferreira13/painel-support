/* ------------------------------------------------------------------------- *
 * app.js — shell (menu lateral + topo + roteador) e todas as telas:
 *   • Início (hero)
 *   • Dashboard: analistas, reguladores, consultores
 *   • Preenchimento: analistas, reguladores, consultores
 * ------------------------------------------------------------------------- */
(function () {
  "use strict";
  const GS = window.GS;
  const { el, svgIcone, aoAtivar, comDica, nf, pct, pct1, moeda, dataBr, momentoBr, norm, vazio, plural, mesRotulo, ICONES } = GS;
  const G = GS.graficos;

  /* ===================================================== modelo de pendência (analistas/consultores) */
  const PEND = {
    "PREENCHER": { rotulo: "A preencher", plural: "A preencher", classe: "preencher", cor: "var(--aviso)", icone: "preencher" },
    "ATRASADO": { rotulo: "Atrasado", plural: "Atrasados", classe: "atrasado", cor: "var(--critico)", icone: "atraso" },
    "EM DIA": { rotulo: "Em dia", plural: "Em dia", classe: "emdia", cor: "var(--cinza)", icone: "relogio" },
    "CONCLUÍDO": { rotulo: "Concluído", plural: "Concluídos", classe: "concluido", cor: "var(--bom)", icone: "concluido" },
  };
  const ORDEM_PEND = { "ATRASADO": 0, "PREENCHER": 1, "EM DIA": 2, "CONCLUÍDO": 3 };
  function selo(k) { const s = el("span", { class: "selo" }); s.append(svgIcone(ICONES[PEND[k].icone], PEND[k].cor), el("span", null, PEND[k].rotulo)); return s; }
  function pendencia(p, dados) {
    if (GS.FONTE.live) {   // dados reais: atraso = coluna "Dias em atraso" (SIGA O) > 0
      if (p._concluido) return "CONCLUÍDO";
      if (p._negado) return "EM DIA";
      return (p.diasAtraso || 0) > 0 ? "ATRASADO" : "EM DIA";
    }
    const s = norm(p.situacao);
    if (!s) return "PREENCHER";
    if (s === dados.listas.concluido) return "CONCLUÍDO";
    return p.prazo && p.prazo < GS.HOJE ? "ATRASADO" : "EM DIA";
  }
  // Atraso unificado (gerencial + BIs): coluna "Dias em atraso" (SIGA O) > 0, fora concluído/negado.
  function estaAtrasado(p, dados) {
    if (p.setor === "REGULADORES") {
      if (norm(p.statusRegulacao) === "Regularizado") return false;
      if (p.statusSiga === "NEGADO" || p.statusSga === "NEGADO") return false;
      return (p.diasAtraso || 0) > 0;
    }
    return pendencia(p, dados) === "ATRASADO";
  }
  const pessoaDe = (p, cfg) => norm(p[cfg.pessoaCampo]) || p.responsavel || "(sem responsável)";
  function valorColuna(p, col, cfg) {
    if (col.key === "analistaEff" || col.key === "consultorEff") return pessoaDe(p, cfg);
    if (col.tipo === "data") return dataBr(p[col.key]);
    if (col.tipo === "moeda") { const v = p[col.key]; return v ? moeda.format(v) : ""; }
    if (col.tipo === "mes") { const v = p[col.key]; return v ? v.slice(5, 7) + "/" + v.slice(0, 4) : ""; }
    const v = p[col.key];
    return v === null || v === undefined ? "" : v;
  }
  const divergente = (p) => p.statusSga !== "" && p.statusSiga !== p.statusSga;

  /* ===================================================== menu lateral + topo */
  const NAV = [
    { itens: [{ rota: "inicio", rotulo: "Início", icone: "inicio" }] },
    { rot: "Dashboards", itens: GS.DASH_ORDEM.map((c) => ({ rota: "dashboard/" + c, rotulo: GS.SETORES[c].rotulo, icone: GS.SETORES[c].icone })) },
    { rot: "Preenchimento", itens: GS.ORDEM_PREENCHIMENTO.map((c) => ({ rota: "preenchimento/" + c, rotulo: GS.SETORES[c].rotulo, icone: "preencher" })) },
  ];

  function construirShell() {
    const lateral = document.getElementById("lateral");
    const nav = lateral.querySelector("nav");
    nav.replaceChildren();
    for (const grupo of NAV) {
      if (!grupo.itens.length) continue;   // não mostra grupo vazio (ex.: Preenchimento quando não há)
      if (grupo.rot) nav.append(el("div", { class: "grupo-rot" }, grupo.rot));
      for (const it of grupo.itens) {
        const a = el("a", { class: "item", href: "#/" + it.rota, "data-rota": it.rota });
        a.append(svgIcone(ICONES[it.icone], "#e4e3e2", 17), el("span", null, it.rotulo));
        nav.append(a);
      }
    }
    // selo de fonte no topo (atualizado também quando a fonte ao vivo resolve)
    atualizarSeloFonte();
    // menu mobile
    const abrir = document.getElementById("abrir-menu");
    const fechar = () => document.body.classList.remove("menu-aberto");
    abrir.addEventListener("click", () => document.body.classList.toggle("menu-aberto"));
    lateral.querySelector(".fechar-lat").addEventListener("click", fechar);
    document.querySelector(".sombra-menu").addEventListener("click", fechar);
  }

  function atualizarSeloFonte() {
    const fonte = document.getElementById("selo-fonte");
    if (fonte) {
      fonte.className = "selo-fonte" + (GS.FONTE.live ? " live" : "");
      fonte.replaceChildren(el("span", { class: "ponto" }), el("span", null, GS.FONTE.rotulo));
    }
    const g = document.getElementById("gerado-topo");
    if (g) g.textContent = (GS.GERADO && GS.GERADO.br) || "";
  }
  GS.aoMudarFonte = atualizarSeloFonte;   // chamado por dados.js quando a fonte ao vivo resolve

  function marcarAtivo(rota) {
    for (const a of document.querySelectorAll(".lateral a.item")) {
      const r = a.getAttribute("data-rota");
      a.classList.toggle("ativo", r === rota || (rota.startsWith(r + "/") && r !== "inicio"));
    }
  }
  function trilha(partes) {
    const t = document.getElementById("trilha");
    const nos = [];
    partes.forEach((p, i) => {
      if (i) nos.push(el("span", { class: "sep" }, "›"));
      nos.push(i === partes.length - 1 ? el("b", null, p) : el("span", null, p));
    });
    t.replaceChildren(...nos);
  }

  /* ===================================================== blocos reutilizáveis */
  function abertura(cfg, titulo, lede) {
    const s = el("section", { class: "abertura" });
    const w = el("div", { class: "largura" });
    w.append(el("span", { class: "etiqueta" }, cfg.etiqueta), el("h1", null, titulo), el("p", { class: "lede" }, lede));
    s.append(w);
    return s;
  }
  function cartao(classe, titulo, sub) {
    const c = el("section", { class: "cartao " + (classe || "") });
    if (titulo) c.append(el("h2", null, titulo));
    if (sub) c.append(el("p", { class: "sub" }, sub));
    const corpo = el("div");
    c.append(corpo);
    return { c, corpo };
  }
  function indicadorFixo(rotulo, valor, nota, icone, cor) {
    const t = el("div", { class: "indicador" });
    const r = el("div", { class: "rotulo" });
    if (icone) r.append(svgIcone(ICONES[icone], cor || "var(--verde-600)", 15));
    r.append(el("span", null, rotulo));
    t.append(r, el("div", { class: "valor" }, valor), el("div", { class: "nota" }, nota));
    return t;
  }

  /* lista de processos: tabela ordenável e paginada */
  function listaProcessos(corpo, processos, cfg, estado, aoEditar) {
    const COLS = cfg.colunas;
    const POR_PAGINA = 40;
    estado.lista = estado.lista || { ordem: "diasAberto", desc: true, pagina: 0 };
    const L = estado.lista;
    const tabelaWrap = el("div", { class: "rolagem" });
    const table = el("table", { class: "lista" });
    const thead = el("thead"), trCab = el("tr");
    for (const col of COLS) {
      const th = el("th", { scope: "col", tabindex: "0", "aria-sort": L.ordem === col.key ? (L.desc ? "descending" : "ascending") : "none" }, col.rot);
      if (L.ordem === col.key) th.append(el("span", { class: "seta", "aria-hidden": "true" }, L.desc ? " ▼" : " ▲"));
      aoAtivar(th, () => { if (L.ordem === col.key) L.desc = !L.desc; else { L.ordem = col.key; L.desc = false; } L.pagina = 0; desenhar(); });
      trCab.append(th);
    }
    thead.append(trCab);
    const tbody = el("tbody");
    table.append(thead, tbody);
    tabelaWrap.append(table);
    const info = el("span");
    const pag = el("span", { class: "paginas" });
    const ant = el("button", { class: "botao claro", type: "button" }, "Anterior");
    const prox = el("button", { class: "botao claro", type: "button" }, "Próxima");
    const numPag = el("span");
    pag.append(ant, numPag, prox);
    const rodape = el("div", { class: "rodape-lista" });
    rodape.append(info, pag);
    ant.addEventListener("click", () => { L.pagina--; desenhar(); });
    prox.addEventListener("click", () => { L.pagina++; desenhar(); });

    function ordenadas() {
      const sinal = L.desc ? -1 : 1;
      const get = (p) => (L.ordem === "analistaEff" || L.ordem === "consultorEff") ? pessoaDe(p, cfg) : p[L.ordem];
      return [...processos].sort((a, b) => {
        const x = get(a), y = get(b);
        if (typeof x === "number" || typeof y === "number") return sinal * ((x ?? -1) - (y ?? -1));
        return sinal * String(x ?? "").localeCompare(String(y ?? ""), "pt-BR", { numeric: true });
      });
    }
    function desenhar() {
      const ord = ordenadas();
      const paginas = Math.max(1, Math.ceil(ord.length / POR_PAGINA));
      L.pagina = Math.min(Math.max(0, L.pagina), paginas - 1);
      const inicio = L.pagina * POR_PAGINA, pagina = ord.slice(inicio, inicio + POR_PAGINA);
      tbody.replaceChildren(...pagina.map((p) => {
        const tr = el("tr");
        for (const col of COLS) {
          const td = el("td", col.classe ? { class: col.classe } : null);
          if (col.editavel) {
            const inp = el("input", { type: col.tipo === "data" ? "date" : "text", class: "edit-cel", value: p[col.key] == null ? "" : p[col.key] });
            inp.addEventListener("change", async () => {
              inp.classList.remove("salvo", "erro"); inp.disabled = true;
              let ok = true;
              try { ok = aoEditar ? await aoEditar(p, col.key, inp.value) : true; } catch (_) { ok = false; }
              inp.disabled = false; inp.classList.add(ok ? "salvo" : "erro");
              setTimeout(() => inp.classList.remove("salvo", "erro"), 2200);
            });
            td.append(inp);
          } else {
            const val = valorColuna(p, col, cfg);
            if (col.difere && divergente(p) && val) td.append(el("span", { class: "difere", title: "Diferente do status no SIGA" }, val));
            else td.textContent = val === "" ? "—" : val;
          }
          tr.append(td);
        }
        return tr;
      }));
      if (!pagina.length) { const tr = el("tr"); tr.append(el("td", { colspan: COLS.length, class: "vazio" }, "Nenhum processo com os filtros atuais.")); tbody.append(tr); }
      info.textContent = ord.length ? `Mostrando ${nf.format(inicio + 1)}–${nf.format(inicio + pagina.length)} de ${nf.format(ord.length)}` : "";
      numPag.textContent = ` ${L.pagina + 1} / ${paginas} `;
      ant.disabled = L.pagina === 0; prox.disabled = L.pagina >= paginas - 1;
      estado.ordenadas = ord;
    }
    corpo.replaceChildren(tabelaWrap, rodape);
    desenhar();
  }

  /* tabela por pessoa (analista/regulador/consultor) */
  function tabelaPessoas(corpo, processos, cfg, colunasDef, estado, aoClicar, nomeDe, chaveAtiva) {
    const nome_ = nomeDe || ((p) => pessoaDe(p, cfg));
    const ativaKey = chaveAtiva || "pessoa";
    const m = new Map();
    for (const p of processos) { const nome = nome_(p); (m.get(nome) || m.set(nome, []).get(nome)).push(p); }
    if (!m.size) { corpo.replaceChildren(el("div", { class: "vazio" }, "Nenhum processo com os filtros atuais.")); return; }
    const t = el("table", { class: "dados" });
    const cab = el("tr");
    for (const cd of colunasDef) cab.append(el("th", { scope: "col" }, cd.rot));
    t.appendChild(el("thead")).append(cab);
    const tb = t.appendChild(el("tbody"));
    const linhas = [...m.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "pt-BR"));
    for (const [nome, g] of linhas) {
      const tr = el("tr", { tabindex: "0", role: "button", class: estado[ativaKey] === nome ? "ativa" : "", "aria-label": `${nome}: ${g.length} processos. Filtrar` });
      colunasDef.forEach((cd, i) => {
        if (i === 0) { tr.append(el("td", null, nome)); return; }
        if (cd.prog) {
          const [feito, tot] = cd.prog(g);
          const td = el("td");
          const prog = el("span", { class: "progresso" }), trilho = el("span", { class: "trilho" }), barra = el("span", { class: "barra" });
          barra.style.width = (tot ? 100 * feito / tot : 0) + "%"; trilho.append(barra);
          prog.append(trilho, el("span", { class: "pct" }, pct(feito, tot)));
          td.append(prog); tr.append(td); return;
        }
        const v = cd.valor(g);
        tr.append(el("td", v ? null : { class: "zero" }, nf.format(v)));
      });
      if (aoClicar) aoAtivar(tr, () => aoClicar(nome));
      tb.append(tr);
    }
    corpo.replaceChildren(t);
  }

  /* barras genéricas por campo. `limite` (sem ordemFixa) mostra o top N e agrupa o resto em "Outras". */
  function barrasPorCampo(corpo, processos, campoFn, ordemFixa, aoClicar, estado, ativoChave, limite) {
    const n = new Map();
    for (const p of processos) { const k = campoFn(p); n.set(k, (n.get(k) || 0) + 1); }
    let chaves = ordemFixa ? ordemFixa.slice() : [...n.keys()];
    for (const k of n.keys()) if (!chaves.includes(k)) chaves.push(k);
    let resto = 0;
    if (limite && !ordemFixa && chaves.length > limite) {
      chaves.sort((a, b) => (n.get(b) || 0) - (n.get(a) || 0) || String(a).localeCompare(String(b), "pt-BR"));
      // mantém a chave ativa visível mesmo fora do top
      const topo = chaves.slice(0, limite);
      if (estado && estado[ativoChave] && !topo.includes(estado[ativoChave])) topo[limite - 1] = estado[ativoChave];
      for (const k of chaves) if (!topo.includes(k)) resto += n.get(k) || 0;
      chaves = topo;
    }
    const itens = chaves.map((k) => ({ chave: k, nome: k === "" ? "(não preenchido)" : k, valor: n.get(k) || 0, ativa: estado && estado[ativoChave] === k }));
    if (resto) itens.push({ nome: "Outras", valor: resto });   // sem chave = não clicável
    G.barras(corpo, itens, processos.length, aoClicar);
  }

  /* filtros (barra) */
  function construirFiltros(cfg, dados, estado, aoMudar) {
    const sec = el("section", { class: "filtros", "aria-label": "Filtros" });
    const w = el("div", { class: "largura" });
    const selects = {};
    function campoSelect(id, rotulo, pares, valorAtual) {
      const lab = el("label", { class: "campo" }, rotulo);
      const s = el("select");
      s.replaceChildren(...pares.map(([v, t]) => el("option", { value: v }, t)));
      s.value = valorAtual === null ? "*" : valorAtual;
      s.addEventListener("change", aoMudar);
      lab.append(s); selects[id] = s; w.append(lab);
    }
    function campoData(id, rotulo, valorAtual) {
      const lab = el("label", { class: "campo" }, rotulo);
      const inp = el("input", { type: "date", min: "2015-01-01", max: "2099-12-31" });
      inp.value = valorAtual || "";
      inp.addEventListener("change", aoMudar);
      lab.append(inp); selects[id] = inp; w.append(lab);
    }
    if (cfg.modelo === "geral") {
      const distintos = (chave) => [...new Set(dados.processos.map((p) => p[chave]))];
      campoSelect("setor", "Setor", [["", "Todos"], ...(dados.listas.setores || []).map((s) => [s, s])], estado.setor);
      campoSelect("fsiga", "Status SIGA", [["*", "Todos"], ...distintos("statusSiga").filter(Boolean).sort().map((s) => [s, s])], estado.fsiga);
      campoSelect("fsga", "Status SGA", [["*", "Todos"], ...distintos("statusSga").sort().map((s) => [s, vazio(s)])], estado.fsga);
    } else {
      const listaPessoas = dados.listas[cfg.pessoas] || [];
      campoSelect("pessoa", cfg.rotuloPessoa || cfg.rotulo.replace(/e?s$/, ""), [["", "Todos"], ...listaPessoas.map((p) => [p, p])], estado.pessoa);
      if (cfg.modelo === "pendencia") {
        const distintos = (chave) => [...new Set(dados.processos.map((p) => (p[chave] == null ? "" : String(p[chave]))))].sort((a, b) => a.localeCompare(b, "pt-BR"));
        campoSelect("situacao", "Situação", [["*", "Todas"], ["", "(não preenchida)"], ...dados.listas.situacoes.map((s) => [s, s])], estado.situacao);
        campoSelect("pend", "Pendência", [["", "Todas"], ["acao", "Precisam de ação"], ["ATRASADO", "Atrasados"], ["PREENCHER", "A preencher"], ["EM DIA", "Em dia"], ["CONCLUÍDO", "Concluídos"]], estado.pend);
        campoSelect("fsga", "Status SGA", [["*", "Todos"], ...distintos("statusSga").map((s) => [s, s === "" ? "(não preenchido)" : s])], estado.fsga);
        campoSelect("evento", "Evento", [["", "Todos"], ...distintos("evento").filter(Boolean).map((s) => [s, s])], estado.evento);
        campoSelect("cobertura", "Cobertura", [["", "Todas"], ...distintos("cobertura").filter(Boolean).map((s) => [s, s])], estado.cobertura);
        campoSelect("cidade", "Cidade", [["", "Todas"], ...distintos("cidade").filter(Boolean).map((s) => [s, s])], estado.cidade);
        campoSelect("cooperativa", "Cooperativa", [["", "Todas"], ...distintos("cooperativa").filter(Boolean).map((s) => [s, s])], estado.cooperativa);
        campoSelect("consultor", "Consultor", [["", "Todos"], ...distintos("consultor").filter(Boolean).map((s) => [s, s])], estado.consultor);
      } else if (cfg.modelo === "regulacao") {
        campoSelect("reguladorAnalista", "Reg. analista", [["", "Todos"], ...(dados.listas.reguladoresAnalistas || []).map((p) => [p, p])], estado.reguladorAnalista);
        campoSelect("statusRegulacao", "Status", [["", "Todos"], ...dados.listas.statusReg.map((s) => [s, s])], estado.statusRegulacao);
      }
    }
    // filtros comuns: Estado + Tarefa + Período (data por dashboard)
    const distinto = (campo) => [...new Set(dados.processos.map((p) => (p[campo] == null ? "" : String(p[campo]))).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const ufs = distinto("uf");
    if (ufs.length) campoSelect("uf", "Estado", [["", "Todos"], ...ufs.map((u) => [u, u])], estado.uf);
    const tarefas = distinto("tarefa");
    if (tarefas.length) campoSelect("tarefa", "Tarefa", [["", "Todas"], ...tarefas.map((t) => [t, t])], estado.tarefa);
    // data: analistas=comunicado, reguladores/consultores=autorização; gerencial escolhe entre as duas
    const NOMES_DATA = { dataComunicado: "comunicado", dataAutorizado: "autorização", abertura: "abertura" };
    if (!cfg.dataCampo) campoSelect("dataCampo", "Data por", [["dataComunicado", "Data comunicado"], ["dataAutorizado", "Data autorização"]], estado.dataCampo);
    const rotD = cfg.dataCampo ? (NOMES_DATA[cfg.dataCampo] || "") : "";
    campoData("dataDe", "De" + (rotD ? " (" + rotD + ")" : ""), estado.dataDe);
    campoData("dataAte", "Até", estado.dataAte);
    const busca = el("input", { type: "search", placeholder: "protocolo, nome ou placa" });
    busca.value = estado.busca || "";
    const labB = el("label", { class: "campo" }, "Buscar"); labB.append(busca); w.append(labB);
    selects.busca = busca;
    let timer = 0;
    busca.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(aoMudar, 180); });
    const limpar = el("button", { class: "botao claro", type: "button" }, "Limpar filtros");
    limpar.addEventListener("click", () => {
      Object.assign(estado, { pessoa: "", reguladorAnalista: "", situacao: null, pend: "", statusRegulacao: "", busca: "", setor: "", fsiga: null, fsga: null,
                              evento: "", cobertura: "", marca: "", modelo: "", uf: "", cidade: "", cooperativa: "", consultor: "", tarefa: "", dataDe: "", dataAte: "",
                              soDivergente: false, semParticipacao: false, negadoSemMotivo: false, semOrcamentista: false, semAnalista: false, soAtrasados: false });
      const naoFiltrado = { situacao: "*", fsiga: "*", fsga: "*" };
      for (const k in selects) { const s = selects[k]; if (s.tagName === "INPUT") s.value = ""; else s.value = naoFiltrado[k] || ""; }
      aoMudar();
    });
    w.append(limpar);
    sec.append(w);
    estado._selects = selects;
    return sec;
  }
  function lerFiltros(estado, cfg) {
    const s = estado._selects; if (!s) return;
    if (cfg.modelo === "geral") {
      estado.setor = s.setor.value;
      estado.fsiga = s.fsiga.value === "*" ? null : s.fsiga.value;
      estado.fsga = s.fsga.value === "*" ? null : s.fsga.value;
    } else {
      estado.pessoa = s.pessoa.value;
      if (cfg.modelo === "pendencia") {
        estado.situacao = s.situacao.value === "*" ? null : s.situacao.value; estado.pend = s.pend.value;
        if (s.fsga) estado.fsga = s.fsga.value === "*" ? null : s.fsga.value;
        if (s.evento) estado.evento = s.evento.value;
        if (s.cobertura) estado.cobertura = s.cobertura.value;
        if (s.cidade) estado.cidade = s.cidade.value;
        if (s.cooperativa) estado.cooperativa = s.cooperativa.value;
        if (s.consultor) estado.consultor = s.consultor.value;
      }
      if (cfg.modelo === "regulacao") { estado.statusRegulacao = s.statusRegulacao.value; if (s.reguladorAnalista) estado.reguladorAnalista = s.reguladorAnalista.value; }
    }
    if (s.uf) estado.uf = s.uf.value;
    if (s.tarefa) estado.tarefa = s.tarefa.value;
    if (s.dataCampo) estado.dataCampo = s.dataCampo.value;
    if (s.dataDe) estado.dataDe = s.dataDe.value;
    if (s.dataAte) estado.dataAte = s.dataAte.value;
    estado.busca = s.busca.value.trim();
  }
  function aplicarFiltros(processos, cfg, dados, estado) {
    const termo = GS.semAcento(estado.busca || "");
    const dcampo = cfg.dataCampo || estado.dataCampo || "abertura";   // qual data o De/Até usa
    return processos.filter((p) => {
      if (cfg.modelo === "geral" && estado.setor && p.setor !== estado.setor) return false;
      // filtros de atributo — valem em qualquer dashboard (setados por gráfico, matriz ou select)
      if (estado.fsiga != null && p.statusSiga !== estado.fsiga) return false;
      if (estado.fsga != null && p.statusSga !== estado.fsga) return false;
      if (estado.evento && (p.evento || "") !== estado.evento) return false;
      if (estado.cobertura && (p.cobertura || "") !== estado.cobertura) return false;
      if (estado.marca && (p.marca || "") !== estado.marca) return false;
      if (estado.modelo && (p.modelo || "") !== estado.modelo) return false;
      if (estado.uf && (p.uf || "") !== estado.uf) return false;
      if (estado.cidade && (p.cidade || "") !== estado.cidade) return false;
      if (estado.cooperativa && (p.cooperativa || "") !== estado.cooperativa) return false;
      if (estado.tarefa && (p.tarefa || "") !== estado.tarefa) return false;
      if (estado.consultor && (p.consultor || "") !== estado.consultor) return false;
      if (estado.dataDe && (p[dcampo] || "") < estado.dataDe) return false;
      if (estado.dataAte && (p[dcampo] || "") > estado.dataAte) return false;
      if (estado.soDivergente && !divergente(p)) return false;
      if (estado.semParticipacao && (p.participacao || 0) > 0) return false;
      if (estado.negadoSemMotivo && !(norm(p.statusSiga) === "NEGADO" && norm(p.statusSga) === "NEGADO" && !norm(p.classif))) return false;
      if (estado.semOrcamentista && !(norm(p.responsavel) === "" && !(GS.semAcento(p.tarefa).includes("ANALISE") && GS.semAcento(p.tarefa).includes("PROCESSO")))) return false;
      if (estado.semAnalista && norm(p.reguladorAnalista) !== "") return false;
      if (estado.pessoa && pessoaDe(p, cfg) !== estado.pessoa) return false;
      if (cfg.modelo === "pendencia") {
        if (estado.situacao !== null && estado.situacao !== undefined && norm(p.situacao) !== estado.situacao) return false;
        if (estado.pend === "acao" && !["ATRASADO", "PREENCHER"].includes(pendencia(p, dados))) return false;
        else if (estado.pend && estado.pend !== "acao" && pendencia(p, dados) !== estado.pend) return false;
      }
      if (cfg.modelo === "regulacao") {
        if (estado.statusRegulacao && p.statusRegulacao !== estado.statusRegulacao) return false;
        if (estado.reguladorAnalista && norm(p.reguladorAnalista) !== estado.reguladorAnalista) return false;
      }
      if (estado.soAtrasados && !estaAtrasado(p, dados)) return false;
      if (termo) {
        const alvo = GS.semAcento([p.protocoloSiga, p.protocoloSga, p.nome, p.placaSiga, (p.placaSiga || "").replace("-", "")].join(" "));
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }

  /* ===================================================== INÍCIO (hero) */
  async function renderInicio(mount) {
    trilha(["Sinistro", "Início"]);
    mount.replaceChildren(carregando());
    await GS.DB.garantir();
    const r = GS.DB.resumo();
    const hero = el("section", { class: "hero" });
    const hw = el("div", { class: "largura" });
    const etq = el("span", { class: "etiqueta-hero" }); etq.append(el("span", null, "Grupo Support"), el("span", null, "· Rotina do sinistro"));
    const h1 = el("h1", { html: 'Painel do <em>sinistro</em>, tudo em um só lugar.' });
    const p = el("p", { class: "lede" }, "Dashboards e preenchimento dos setores de analistas, reguladores e consultores — no mesmo padrão visual da conferência e do acompanhamento, integrados em uma única página.");
    const acoes = el("div", { class: "acoes" });
    const b1 = el("a", { class: "btn-hero cheio", href: "#/dashboard/sinistro" }); b1.append(el("span", null, "Ver dashboards"), svgIcone(ICONES.seta, "#2d350a", 16));
    const b2 = el("a", { class: "btn-hero vazado", href: "#/dashboard/reguladores" }, "Reguladores (vistoria inicial)");
    acoes.append(b1, b2);
    const nums = el("div", { class: "hero-nums" });
    const cel = (v, t) => { const n = el("div", { class: "n" }); n.append(el("b", null, v), el("span", null, t)); return n; };
    nums.append(
      cel(nf.format(r.total), "processos em aberto"),
      cel(nf.format(r.porSetor.analistas), "com os analistas"),
      cel(nf.format(r.porSetor.reguladores), "com os reguladores"),
      cel(nf.format(r.porSetor.consultores), "com os consultores"),
      cel(nf.format(r.aPreencher), "a preencher"),
    );
    hw.append(etq, h1, p, acoes, nums);
    hero.append(hw);

    // cartões de navegação
    const sec = el("section", { class: "hero-cartoes" });
    const sw = el("div", { class: "largura" });
    sw.append(el("h2", null, "Funcionalidades"));
    const grade = el("div", { class: "cartoes-grade" });
    const cartoes = [{ rota: "dashboard/sinistro", icone: "sinistro", titulo: "Dashboard · Sinistro", desc: GS.SETORES.sinistro.ledeDash, tags: ["Visão geral", "Matriz SIGA×SGA", "Negativas"] }];
    for (const chave of GS.ORDEM_SETORES) {
      const cfg = GS.SETORES[chave];
      cartoes.push({ rota: "dashboard/" + chave, icone: cfg.icone, titulo: "Dashboard · " + cfg.rotulo, desc: cfg.ledeDash, tags: ["Indicadores", "Gráficos", "Lista"] });
      if (GS.ORDEM_PREENCHIMENTO.includes(chave))
        cartoes.push({ rota: "preenchimento/" + chave, icone: "preencher", titulo: "Preenchimento · " + cfg.rotulo, desc: cfg.ledeForm, tags: ["Vistoria inicial", "Salvar", GS.FONTE.live ? "Sheets ao vivo" : "Sheets (em breve)"] });
    }
    for (const c of cartoes) {
      const a = el("a", { class: "cartao-nav", href: "#/" + c.rota });
      const ic = el("div", { class: "ic" }); ic.append(svgIcone(ICONES[c.icone], "var(--verde-700)", 22));
      const tags = el("div", { class: "tags" }); for (const t of c.tags) tags.append(el("span", null, t));
      a.append(ic, el("h3", null, c.titulo), el("p", null, c.desc), tags, el("span", { class: "seta" }, "Abrir →"));
      grade.append(a);
    }
    sw.append(grade);
    sec.append(sw);
    mount.replaceChildren(hero, sec);
  }

  /* faixa de destaque dos atrasados (gerencial: acusa o setor; BIs: conta do setor) */
  function faixaAtraso(dados, cfg, estado, atualizar) {
    const atrasados = dados.processos.filter((p) => estaAtrasado(p, dados));
    if (!atrasados.length) return null;
    const faixa = el("section", { class: "faixa-atraso", role: "alert" });
    const w = el("div", { class: "largura fa" });
    const esq = el("div", { class: "fa-esq" });
    esq.append(svgIcone(ICONES.atraso, "#fff", 22));
    const txt = el("div", { class: "fa-txt" });
    const btn = el("button", { type: "button", class: "fa-btn" });
    const rotBtn = () => { btn.textContent = estado.soAtrasados ? "Tirar filtro" : "Ver só atrasados"; btn.setAttribute("aria-pressed", String(!!estado.soAtrasados)); };
    const n = atrasados.length, plr = n === 1 ? "processo atrasado" : "processos atrasados";
    if (cfg.modelo === "geral") {
      const porSetor = new Map();
      for (const p of atrasados) porSetor.set(p.setor, (porSetor.get(p.setor) || 0) + 1);
      const top = [...porSetor.entries()].sort((a, b) => b[1] - a[1]);
      txt.append(el("b", null, `${nf.format(n)} ${plr}`),
                 el("span", null, `Setor mais crítico: ${top[0][0]} (${nf.format(top[0][1])}). Bom cobrar os responsáveis.`));
      const chips = el("div", { class: "fa-chips" });
      for (const [s, q] of top) {
        const c = el("button", { type: "button", class: "fa-chip", "aria-label": `${s}: ${q} atrasados. Filtrar` });
        c.append(el("b", null, s), el("span", null, nf.format(q)));
        aoAtivar(c, () => { estado.setor = s; estado.soAtrasados = true; if (estado._selects && estado._selects.setor) estado._selects.setor.value = s; rotBtn(); atualizar(); });
        chips.append(c);
      }
      txt.append(chips);
    } else {
      txt.append(el("b", null, `${nf.format(n)} ${plr} neste setor`),
                 el("span", null, "Precisam de ação imediata — destaque para cobrança."));
    }
    esq.append(txt);
    rotBtn();
    btn.addEventListener("click", () => { estado.soAtrasados = !estado.soAtrasados; rotBtn(); atualizar(); });
    w.append(esq, btn); faixa.append(w);
    return faixa;
  }

  /* ===================================================== DASHBOARD */
  async function renderDashboard(chave, mount) {
    const cfg = GS.SETORES[chave];
    trilha(["Sinistro", "Dashboards", cfg.rotulo]);
    mount.replaceChildren(carregando());
    const dados = await GS.DB.carregar(chave);
    const estado = { pessoa: "", reguladorAnalista: "", regDim: "orcamentista", situacao: null, pend: "", statusRegulacao: "", busca: "", setor: "", fsiga: null, fsga: null,
                     evento: "", cobertura: "", marca: "", modelo: "", uf: "", cidade: "", cooperativa: "", consultor: "", tarefa: "", dataCampo: "dataComunicado", dataDe: "", dataAte: "",
                     soDivergente: false, semParticipacao: false, negadoSemMotivo: false, semOrcamentista: false, semAnalista: false, vidrosMarca: false, vidrosModelo: false };

    // edição inline (ex.: Data da Vistoria Inicial no dashboard dos reguladores) -> grava no Sheets
    async function aoEditarCelula(p, campo, valor) {
      p[campo] = valor;
      const res = await GS.DB.salvarValores([{ protocolo: p.protocoloSiga, campo, valor }]);
      return !(res && res.ok === false);
    }

    mount.replaceChildren();
    mount.append(abertura(cfg, cfg.tituloDash, cfg.ledeDash));
    const fil = construirFiltros(cfg, dados, estado, () => { lerFiltros(estado, cfg); atualizar(); });
    const faixa = faixaAtraso(dados, cfg, estado, () => atualizar());
    if (faixa) mount.append(faixa);
    mount.append(fil);
    const area = el("div", { class: "conteudo-sec" });
    const w = el("div", { class: "largura" });
    const resumo = el("div", { class: "indicadores" });
    const grade = el("div", { class: "grade" });
    w.append(resumo, grade);
    area.append(w);
    mount.append(area);

    // monta a grade conforme o setor
    const cards = {};
    if (cfg.modelo === "pendencia") {
      cards.pessoas = cartao("sete", "Por " + cfg.rotulo.replace(/e?s$/, "").toLowerCase(), "Clique em uma linha para filtrar.");
      cards.situacao = GS.FONTE.live
        ? cartao("cinco", "Por status (SGA)", "Distribuição pelo status no SGA. Clique para ver os processos.")
        : cartao("cinco", "Por situação", "Situação informada pela equipe. Clique para filtrar.");
      grade.append(cards.situacao.c, cards.pessoas.c);
      cards.evento = cartao("cinco", "Por evento", "Tipo de evento do setor. Clique para filtrar.");
      cards.cobertura = cartao("cinco", "Por cobertura", "Distribuição por cobertura. Clique para filtrar.");
      cards.cidade = cartao("cinco", "Por cidade", "Principais cidades dos processos. Clique para filtrar.");
      cards.matriz = cartao("sete", "Status no SIGA × status no SGA", "Cruzamento dos status. Clique numa célula para filtrar.");
      grade.append(cards.evento.c, cards.cobertura.c, cards.cidade.c, cards.matriz.c);
      if (cfg.temOficinas) { cards.oficinas = cartao("", "Rede de oficinas", "Oficinas homologadas, com vagas e consultor responsável."); grade.append(cards.oficinas.c); }
    } else if (cfg.modelo === "regulacao") {
      cards.status = cartao("cinco", "Por status da regulação", "Situação de cada processo. Clique para filtrar.");
      cards.pessoas = cartao("sete", "Por regulador", "Orçamentista (vistoria/orçamento) ou analista (ID externo). Clique em uma linha para filtrar.");
      // alternador de dimensão: orçamentista × analista
      const dimTog = el("div", { class: "alternar-dim", role: "group", "aria-label": "Dimensão do regulador" });
      const btnOrc = el("button", { type: "button", class: "ativo", "data-dim": "orcamentista" }, "Orçamentista");
      const btnAna = el("button", { type: "button", "data-dim": "analista" }, "Analista");
      dimTog.append(btnOrc, btnAna);
      for (const b of [btnOrc, btnAna]) b.addEventListener("click", () => {
        if (estado.regDim === b.dataset.dim) return;
        estado.regDim = b.dataset.dim;
        btnOrc.classList.toggle("ativo", estado.regDim === "orcamentista");
        btnAna.classList.toggle("ativo", estado.regDim === "analista");
        atualizar();
      });
      cards.pessoas.c.classList.add("com-alternar");
      cards.pessoas.c.insertBefore(dimTog, cards.pessoas.c.firstChild);
      cards.cidade = cartao("cinco", "Por cidade", "Principais cidades dos processos. Clique para filtrar.");
      grade.append(cards.status.c, cards.pessoas.c, cards.cidade.c);
      if (cfg.temMatriz) { cards.matriz = cartao("sete", "Status no SIGA × status no SGA", "Quantos eventos em cada combinação."); grade.append(cards.matriz.c); }
      cards.tarefaOrc = cartao("", "Tarefa × Regulador orçamentista", "Processos em cada tarefa por orçamentista — sem finalizados/negados. Clique numa célula para filtrar.");
      cards.regStatus = cartao("", "Regulador × Status da regulação", "Quantos processos cada regulador tem em cada status. Clique para filtrar.");
      grade.append(cards.tarefaOrc.c, cards.regStatus.c);
    } else { // geral (sinistro)
      cards.mes = cartao("sete", "Eventos por mês", "Pela competência do evento.");
      cards.setor = cartao("cinco", "Por setor", "Distribuição dos eventos entre os setores. Clique para filtrar.");
      cards.evento = cartao("cinco", "Por evento", "Tipo de evento do sinistro. Clique para filtrar.");
      cards.marca = cartao("cinco", "Por marca do veículo", "Clique para filtrar.");
      cards.modelo = cartao("cinco", "Por modelo do veículo", "Clique para filtrar.");
      cards.estado = cartao("cinco", "Por estado (UF)", "Distribuição por UF. Clique para filtrar.");
      cards.cidade = cartao("sete", "Por cidade", "Principais cidades. Clique para filtrar.");
      cards.coop = cartao("cinco", "Por cooperativa", "Distribuição por cooperativa. Clique para filtrar.");
      cards.matriz = cartao("sete", "Status no SIGA × status no SGA", "Quantos eventos em cada combinação. Clique em uma célula para filtrar.");
      cards.motivos = cartao("cinco", "Motivos de negativa", "Classificação dos eventos negados no SIGA ou no SGA.");
      // toggle "Só vidros" nos cartões de marca e modelo
      togglVidros(cards.marca.c, "vidrosMarca");
      togglVidros(cards.modelo.c, "vidrosModelo");
      grade.append(cards.mes.c, cards.setor.c, cards.evento.c, cards.marca.c, cards.modelo.c,
                   cards.estado.c, cards.cidade.c, cards.coop.c, cards.matriz.c, cards.motivos.c);
    }
    function togglVidros(card, chave) {
      const t = el("div", { class: "alternar-dim", role: "group", "aria-label": "Filtrar por vidros" });
      const b = el("button", { type: "button", "data-chave": chave }, "Só vidros");
      t.append(b);
      b.addEventListener("click", () => { estado[chave] = !estado[chave]; b.classList.toggle("ativo", estado[chave]); atualizar(); });
      card.classList.add("com-alternar");
      card.insertBefore(t, card.firstChild);
    }
    const listaCard = { c: el("section", { class: "cartao" }), corpo: el("div") };
    const exportar = el("button", { class: "botao", type: "button" }, "Exportar CSV");
    const cabeca = el("div", { class: "cabeca" });
    const tituloWrap = el("div"); tituloWrap.append(el("h2", null, "Processos"), el("p", { class: "sub lista-sub" }));
    cabeca.append(tituloWrap, exportar);
    listaCard.c.append(cabeca, listaCard.corpo);
    grade.append(listaCard.c);

    function atualizar() {
      const linhas = aplicarFiltros(dados.processos, cfg, dados, estado);
      // indicadores
      resumo.replaceChildren(...indicadores(linhas, cfg, dados, estado, atualizar));
      // gráficos
      if (cfg.modelo === "pendencia") {
        if (GS.FONTE.live)
          barrasPorCampo(cards.situacao.corpo, linhas, (p) => p.statusSga || "", null, (k) => { estado.fsga = estado.fsga === k ? null : k; sincFiltros(); atualizar(); }, estado, "fsga", 12);
        else
          barrasPorCampo(cards.situacao.corpo, linhas, (p) => norm(p.situacao), [...dados.listas.situacoes, ""], (k) => { estado.situacao = estado.situacao === k ? null : k; sincFiltros(); atualizar(); }, estado, "situacao");
        tabelaPessoas(cards.pessoas.corpo, linhas, cfg, colsPessoaPend(dados, cfg), estado, (nome) => { estado.pessoa = estado.pessoa === nome ? "" : nome; sincFiltros(); atualizar(); });
        const togFil = (chave) => (k) => { estado[chave] = estado[chave] === k ? "" : k; sincFiltros(); atualizar(); };
        if (cards.evento) barrasPorCampo(cards.evento.corpo, linhas, (p) => p.evento || "", null, togFil("evento"), estado, "evento", 12);
        if (cards.cobertura) barrasPorCampo(cards.cobertura.corpo, linhas, (p) => p.cobertura || "", null, togFil("cobertura"), estado, "cobertura", 12);
        if (cards.cidade) barrasPorCampo(cards.cidade.corpo, linhas, (p) => p.cidade || "", null, togFil("cidade"), estado, "cidade", 12);
        if (cards.matriz) G.matriz(cards.matriz.corpo, linhas, (p) => p.statusSiga, (p) => p.statusSga, (a, b) => { estado.fsiga = a; estado.fsga = b; sincFiltros(); atualizar(); });
        if (cards.oficinas) oficinasTabela(cards.oficinas.corpo);
      } else if (cfg.modelo === "regulacao") {
        barrasPorCampo(cards.status.corpo, linhas, (p) => p.statusRegulacao || "", dados.listas.statusReg.slice(), (k) => { estado.statusRegulacao = estado.statusRegulacao === k ? "" : k; sincFiltros(); atualizar(); }, estado, "statusRegulacao");
        const dimAna = estado.regDim === "analista";
        const nomeDe = dimAna ? (p) => norm(p.reguladorAnalista) || "(sem analista)" : null;
        tabelaPessoas(cards.pessoas.corpo, linhas, cfg, colsPessoaReg(cfg, dimAna ? "Reg. analista" : "Reg. orçamentista"), estado, (nome) => {
          if (dimAna) estado.reguladorAnalista = (estado.reguladorAnalista === nome || nome === "(sem analista)") ? "" : nome;
          else estado.pessoa = estado.pessoa === nome ? "" : nome;
          sincFiltros(); atualizar();
        }, nomeDe, dimAna ? "reguladorAnalista" : "pessoa");
        if (cards.cidade) barrasPorCampo(cards.cidade.corpo, linhas, (p) => p.cidade || "", null, (k) => { estado.cidade = estado.cidade === k ? "" : k; atualizar(); }, estado, "cidade", 12);
        if (cards.matriz) G.matriz(cards.matriz.corpo, linhas, (p) => p.statusSiga, (p) => p.statusSga, (a, b) => { estado.fsiga = a; estado.fsga = b; sincFiltros(); atualizar(); });
        if (cards.tarefaOrc) {
          const base = linhas.filter((p) => !p._concluido && !p._negado);
          G.matriz(cards.tarefaOrc.corpo, base, (p) => p.tarefa || "", (p) => p.responsavel || "", (a, b) => { estado.tarefa = a; estado.pessoa = b; sincFiltros(); atualizar(); }, "Tarefa", "Orçamentista");
        }
        if (cards.regStatus) G.matriz(cards.regStatus.corpo, linhas, (p) => p.responsavel || "", (p) => p.statusRegulacao || "", (a, b) => { estado.pessoa = a; estado.statusRegulacao = b; sincFiltros(); atualizar(); }, "Regulador", "Status");
      } else { // geral (sinistro)
        const eixo = [...new Set(linhas.map((p) => p.competencia))].sort();
        const conta = new Map(); for (const p of linhas) conta.set(p.competencia, (conta.get(p.competencia) || 0) + 1);
        G.colunasMes(cards.mes.corpo, eixo, conta, (k) => [mesRotulo(k)]);
        barrasPorCampo(cards.setor.corpo, linhas, (p) => p.setor, (dados.listas.setores || []).slice(), (k) => { estado.setor = estado.setor === k ? "" : k; sincFiltros(); atualizar(); }, estado, "setor");
        const togFiltro = (chave) => (k) => { estado[chave] = estado[chave] === k ? "" : k; sincFiltros(); atualizar(); };
        barrasPorCampo(cards.evento.corpo, linhas, (p) => p.evento || "", (dados.listas.eventos || []).slice(), togFiltro("evento"), estado, "evento");
        // marca e modelo com opção "só vidros"
        const soVidros = (p) => p.evento === "VIDROS" || p.setor === "VIDROS";
        const linhasMarca = estado.vidrosMarca ? linhas.filter(soVidros) : linhas;
        const linhasModelo = estado.vidrosModelo ? linhas.filter(soVidros) : linhas;
        barrasPorCampo(cards.marca.corpo, linhasMarca, (p) => p.marca || "", (dados.listas.marcas || []).slice(), togFiltro("marca"), estado, "marca");
        barrasPorCampo(cards.modelo.corpo, linhasModelo, (p) => p.modelo || "", null, togFiltro("modelo"), estado, "modelo", 12);
        barrasPorCampo(cards.estado.corpo, linhas, (p) => p.uf || "", null, togFiltro("uf"), estado, "uf", 14);
        barrasPorCampo(cards.cidade.corpo, linhas, (p) => p.cidade || "", null, togFiltro("cidade"), estado, "cidade", 12);
        barrasPorCampo(cards.coop.corpo, linhas, (p) => p.cooperativa || "", (dados.listas.cooperativas || []).slice(), togFiltro("cooperativa"), estado, "cooperativa");
        G.matriz(cards.matriz.corpo, linhas, (p) => p.statusSiga, (p) => p.statusSga, (a, b) => { estado.fsiga = a; estado.fsga = b; sincFiltros(); atualizar(); });
        motivosNegativa(cards.motivos.corpo, linhas);
      }
      listaProcessos(listaCard.corpo, linhas, cfg, estado, aoEditarCelula);
      for (const s of listaCard.c.querySelectorAll(".lista-sub")) s.textContent = `${nf.format(linhas.length)} de ${nf.format(dados.processos.length)} processos, conforme os filtros acima.`;
      exportar.onclick = () => {
        const cab = cfg.colunas.map((c) => c.rot);
        GS.exportarCsv(`dashboard-${chave}.csv`, cab, (estado.ordenadas || linhas).map((p) => cfg.colunas.map((c) => valorColuna(p, c, cfg))));
      };
    }
    function sincFiltros() {
      const s = estado._selects; if (!s) return;
      if (s.pessoa) s.pessoa.value = estado.pessoa;
      if (s.reguladorAnalista) s.reguladorAnalista.value = estado.reguladorAnalista;
      if (s.situacao) s.situacao.value = estado.situacao === null ? "*" : estado.situacao;
      if (s.statusRegulacao) s.statusRegulacao.value = estado.statusRegulacao;
      if (s.setor) s.setor.value = estado.setor;
      if (s.fsiga) s.fsiga.value = estado.fsiga === null ? "*" : estado.fsiga;
      if (s.fsga) s.fsga.value = estado.fsga === null ? "*" : estado.fsga;
      if (s.evento) s.evento.value = estado.evento;
      if (s.cobertura) s.cobertura.value = estado.cobertura;
      if (s.uf) s.uf.value = estado.uf;
      if (s.cidade && s.cidade.tagName === "SELECT") s.cidade.value = estado.cidade;
    }
    atualizar();
  }

  function indicadores(linhas, cfg, dados, estado, atualizar) {
    if (cfg.modelo === "pendencia") {
      const n = { "PREENCHER": 0, "ATRASADO": 0, "EM DIA": 0, "CONCLUÍDO": 0 };
      for (const p of linhas) n[pendencia(p, dados)]++;
      const total = linhas.length;
      const itens = [indicadorFixo("Processos", nf.format(total), cfg.aba, cfg.icone)];
      for (const k of (GS.FONTE.live ? ["ATRASADO", "EM DIA", "CONCLUÍDO"] : ["PREENCHER", "ATRASADO", "EM DIA", "CONCLUÍDO"])) {
        const ativo = estado.pend === k;
        const b = el("button", { type: "button", class: "indicador" + (ativo ? " ativo" : ""), "aria-pressed": String(ativo) });
        const r = el("div", { class: "rotulo" }); r.append(svgIcone(ICONES[PEND[k].icone], PEND[k].cor, 15), el("span", null, PEND[k].plural));
        b.append(r, el("div", { class: "valor" }, nf.format(n[k])), el("div", { class: "nota" }, ativo ? "filtrando · clique para tirar" : pct(n[k], total) + " dos processos"));
        b.addEventListener("click", () => { estado.pend = ativo ? "" : k; if (estado._selects && estado._selects.pend) estado._selects.pend.value = estado.pend; atualizar(); });
        itens.push(b);
      }
      // "acusar" (clicáveis): status divergente, sem participação, negado×negado sem motivo
      const acusar = [
        { k: "soDivergente", rot: "Status divergente", icone: "info", cor: "var(--aviso)", conta: linhas.filter(divergente).length },
        { k: "semParticipacao", rot: "Sem participação", icone: "dinheiro", cor: "var(--serio)", conta: linhas.filter((p) => (p.participacao || 0) <= 0).length },
        { k: "negadoSemMotivo", rot: "Negado sem motivo", icone: "atraso", cor: "var(--critico)", conta: linhas.filter((p) => norm(p.statusSiga) === "NEGADO" && norm(p.statusSga) === "NEGADO" && !norm(p.classif)).length },
      ];
      for (const a of acusar) {
        const on = estado[a.k];
        const b = el("button", { type: "button", class: "indicador" + (on ? " ativo" : ""), "aria-pressed": String(on) });
        const r = el("div", { class: "rotulo" }); r.append(svgIcone(ICONES[a.icone], a.cor, 15), el("span", null, a.rot));
        b.append(r, el("div", { class: "valor" }, nf.format(a.conta)), el("div", { class: "nota" }, on ? "filtrando · clique para tirar" : pct(a.conta, total) + " — clique para ver"));
        b.addEventListener("click", () => { estado[a.k] = !estado[a.k]; atualizar(); });
        itens.push(b);
      }
      return itens;
    }
    if (cfg.modelo === "geral") {
      const total = linhas.length;
      const neg = linhas.filter((p) => p.statusSiga === "NEGADO" || p.statusSga === "NEGADO").length;
      const dif = linhas.filter(divergente).length;
      const sem = linhas.filter((p) => p.statusSga === "").length;
      const dur = linhas.map((p) => p.diasAberto).filter((d) => typeof d === "number");
      const media = dur.length ? Math.round(dur.reduce((a, b) => a + b, 0) / dur.length) : null;
      return [
        indicadorFixo("Eventos", nf.format(total), cfg.aba, cfg.icone),
        indicadorFixo("Negados", nf.format(neg), pct(neg, total) + " dos eventos", "atraso", "var(--critico)"),
        indicadorFixo("Status diferente", nf.format(dif), pct(dif, total) + " · SIGA × SGA", "info", "var(--aviso)"),
        indicadorFixo("Sem correspondência SGA", nf.format(sem), pct(sem, total) + " dos eventos", "info", "var(--cinza)"),
        indicadorFixo("Dias em aberto", media === null ? "–" : nf.format(media), "média dos eventos", "relogio"),
      ];
    }
    // regulacao
    const total = linhas.length;
    const conta = (s) => linhas.filter((p) => p.statusRegulacao === s).length;
    const negAberto = linhas.filter((p) => (p.statusSiga === "NEGADO" || p.statusSga === "NEGADO")).length;
    const itens = [
      indicadorFixo("Processos", nf.format(total), cfg.aba, cfg.icone),
      indicadorFixo("Em regulação", nf.format(conta("Em regulação")), pct(conta("Em regulação"), total) + " do total", "reguladores"),
      indicadorFixo("Regularizados", nf.format(conta("Regularizado")), pct(conta("Regularizado"), total) + " do total", "concluido", "var(--bom)"),
      indicadorFixo("Aguardando vistoria", nf.format(conta("Aguardando vistoria")), pct(conta("Aguardando vistoria"), total) + " do total", "relogio", "var(--aviso)"),
      indicadorFixo("Negados", nf.format(negAberto), pct(negAberto, total) + " dos processos", "atraso", "var(--critico)"),
    ];
    // "acusar" (clicáveis): negado sem motivo, sem orçamentista (exceto Análise do Processo), sem analista
    const sa = GS.semAcento;
    const acusar = [
      { k: "negadoSemMotivo", rot: "Negado sem motivo", icone: "atraso", cor: "var(--critico)", conta: linhas.filter((p) => norm(p.statusSiga) === "NEGADO" && norm(p.statusSga) === "NEGADO" && !norm(p.classif)).length },
      { k: "semOrcamentista", rot: "Sem orçamentista", icone: "info", cor: "var(--aviso)", conta: linhas.filter((p) => norm(p.responsavel) === "" && !(sa(p.tarefa).includes("ANALISE") && sa(p.tarefa).includes("PROCESSO"))).length },
      { k: "semAnalista", rot: "Sem reg. analista", icone: "info", cor: "var(--serio)", conta: linhas.filter((p) => norm(p.reguladorAnalista) === "").length },
    ];
    for (const a of acusar) {
      const on = estado[a.k];
      const b = el("button", { type: "button", class: "indicador" + (on ? " ativo" : ""), "aria-pressed": String(on) });
      const r = el("div", { class: "rotulo" }); r.append(svgIcone(ICONES[a.icone], a.cor, 15), el("span", null, a.rot));
      b.append(r, el("div", { class: "valor" }, nf.format(a.conta)), el("div", { class: "nota" }, on ? "filtrando · clique para tirar" : pct(a.conta, total) + " — clique para ver"));
      b.addEventListener("click", () => { estado[a.k] = !estado[a.k]; atualizar(); });
      itens.push(b);
    }
    return itens;
  }
  const singular = (cfg) => cfg.rotulo.replace(/e?s$/, "");
  function colsPessoaPend(dados, cfg) {
    const c = (k) => (g) => g.filter((p) => pendencia(p, dados) === k).length;
    return [
      { rot: singular(cfg), valor: () => 0 },
      { rot: "Processos", valor: (g) => g.length },
      { rot: "A preencher", valor: c("PREENCHER") },
      { rot: "Atrasados", valor: c("ATRASADO") },
      { rot: "Em dia", valor: c("EM DIA") },
      { rot: "Concluídos", valor: c("CONCLUÍDO") },
      { rot: "Preenchido", prog: (g) => [g.filter((p) => pendencia(p, dados) !== "PREENCHER").length, g.length] },
    ];
  }
  function colsPessoaReg(cfg, rotulo) {
    const c = (s) => (g) => g.filter((p) => p.statusRegulacao === s).length;
    return [
      { rot: rotulo || singular(cfg), valor: () => 0 },
      { rot: "Processos", valor: (g) => g.length },
      { rot: "Em regulação", valor: c("Em regulação") },
      { rot: "Regularizados", valor: c("Regularizado") },
      { rot: "Negados", valor: (g) => g.filter((p) => p.statusSiga === "NEGADO" || p.statusSga === "NEGADO").length },
      { rot: "Regularizado", prog: (g) => [c("Regularizado")(g), g.length] },
    ];
  }
  function oficinasTabela(corpo) {
    const ofs = GS.DB.listas.oficinas;
    const t = el("table", { class: "dados" });
    const cab = el("tr");
    for (const h of ["Oficina", "Cidade", "UF", "Consultor", "Situação", "Vagas", "Em uso", "Disponíveis"]) cab.append(el("th", { scope: "col" }, h));
    t.appendChild(el("thead")).append(cab);
    const tb = t.appendChild(el("tbody"));
    for (const o of ofs) {
      const tr = el("tr");
      tr.append(el("td", null, o.oficina), el("td", null, o.cidade), el("td", null, o.uf), el("td", null, o.consultor), el("td", null, o.situacao),
        el("td", null, nf.format(o.vagas)), el("td", null, nf.format(o.quantidade)), el("td", o.disponiveis ? null : { class: "zero" }, nf.format(o.disponiveis)));
      tb.append(tr);
    }
    const d = el("div", { class: "rolagem" }); d.append(t);
    corpo.replaceChildren(d);
  }
  function motivosNegativa(corpo, linhas) {
    const n = new Map(); let total = 0;
    for (const p of linhas) {
      if (p.statusSiga === "NEGADO" || p.statusSga === "NEGADO") { const k = p.classif || "(sem classificação)"; n.set(k, (n.get(k) || 0) + 1); total++; }
    }
    const ordenado = [...n.entries()].sort((a, b) => b[1] - a[1]);
    const itens = ordenado.slice(0, 9).map(([nome, valor]) => ({ nome, valor, unidade: "evento", unidadeP: "eventos" }));
    const resto = ordenado.slice(9).reduce((a, [, v]) => a + v, 0);
    if (resto) itens.push({ nome: `Outros (${ordenado.length - 9})`, valor: resto });
    G.barras(corpo, itens, total, null, true);
  }

  /* ===================================================== util de carregamento */
  function carregando() {
    const d = el("div", { class: "largura", style: "padding:40px 0;color:var(--mudo)" }, "Carregando…");
    return d;
  }

  /* ===================================================== PREENCHIMENTO */
  GS.renderFormulario = null; // definido em formulario.js
  function renderPreenchimento(chave, mount) {
    if (GS.renderFormulario) return GS.renderFormulario(chave, mount, GS._helpers);
    mount.replaceChildren(el("div", { class: "largura", style: "padding:40px 0" }, "Preenchimento indisponível."));
  }

  /* ===================================================== roteador */
  function rotaAtual() {
    const h = (location.hash || "").replace(/^#\/?/, "");
    return h || "inicio";
  }
  function navegar() {
    const rota = rotaAtual();
    marcarAtivo(rota.split("/").slice(0, 2).join("/"));
    document.body.classList.remove("menu-aberto", "com-barra");
    for (const n of document.querySelectorAll(".salvar")) n.remove();   // limpa barra de salvar de uma tela anterior
    window.scrollTo(0, 0);
    const mount = document.getElementById("conteudo");
    const [sec, chave] = rota.split("/");
    if (sec === "dashboard" && GS.SETORES[chave]) renderDashboard(chave, mount);
    else if (sec === "preenchimento" && GS.ORDEM_PREENCHIMENTO.includes(chave)) renderPreenchimento(chave, mount);
    else if (sec === "preenchimento" && GS.SETORES[chave]) { location.replace("#/dashboard/" + chave); }  // preenchimento desativado p/ este setor
    else renderInicio(mount);
  }

  // expõe para formulario.js reaproveitar helpers
  GS._helpers = { PEND, ORDEM_PEND, selo, pendencia, pessoaDe, abertura, indicadorFixo, cartao, carregando, trilha, construirFiltros, lerFiltros, aplicarFiltros, barrasPorCampo, tabelaPessoas, colsPessoaPend, colsPessoaReg, valorColuna, listaProcessos, indicadores };

  document.addEventListener("DOMContentLoaded", () => {
    construirShell();
    window.addEventListener("hashchange", navegar);
    navegar();
  });
})();
