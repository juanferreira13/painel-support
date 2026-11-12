/* ------------------------------------------------------------------------- *
 * formulario.js — telas de PREENCHIMENTO (analistas, reguladores, consultores)
 *
 * Cartões de processo editáveis, no padrão do acompanhamento do sinistro.
 * O que a equipe muda fica "não salvo" (localStorage) até clicar em Salvar.
 * Ao salvar: grava no overlay (GS.DB.salvarValores) — e os dashboards passam a
 * refletir — e oferece exportar um JSON das alterações. Depois da validação do
 * grupo support, "Salvar" passa a enviar direto para o Google Sheets.
 * ------------------------------------------------------------------------- */
(function () {
  "use strict";
  const GS = window.GS;
  const { el, svgIcone, aoAtivar, nf, moeda, pct, dataBr, momentoBr, norm, plural, ICONES } = GS;

  GS.renderFormulario = function (chave, mount, H) {
    const cfg = GS.SETORES[chave];
    const { PEND, selo, pendencia, pessoaDe, abertura, indicadorFixo } = H;
    H.trilha(["Sinistro", "Preenchimento", cfg.rotulo]);
    mount.replaceChildren(H.carregando());

    GS.DB.carregar(chave).then((dados) => {
      const PROCS = dados.processos;
      const porProt = new Map(PROCS.map((p) => [p.protocoloSiga, p]));

      // estado de edição (rascunho) e nome de quem preenche
      const CHAVE_RASC = "gs-sinistro:rascunho:" + chave;
      const CHAVE_NOME = "gs-sinistro:nome";
      const lerRasc = () => { try { const o = JSON.parse(localStorage.getItem(CHAVE_RASC) || "{}"); return o && typeof o === "object" ? o : {}; } catch (_) { return {}; } };
      let RASC = lerRasc();
      const guardarRasc = () => { try { localStorage.setItem(CHAVE_RASC, JSON.stringify(RASC)); } catch (_) {} };
      const kRasc = (prot, campo) => prot + "|" + campo;
      const valorBase = (p, campo) => { const v = p[campo]; return v === null || v === undefined ? "" : v; };
      const valorAtual = (p, campo) => (kRasc(p.protocoloSiga, campo) in RASC ? RASC[kRasc(p.protocoloSiga, campo)].v : valorBase(p, campo));
      const temRascunho = (p) => cfg.campos.some((c) => kRasc(p.protocoloSiga, c.id) in RASC);

      // estado de pendência do cartão (serve para os dois modelos)
      function estadoProcesso(p) {
        if (cfg.modelo === "pendencia") {
          const s = norm(valorAtual(p, "situacao"));
          if (!s) return "PREENCHER";
          if (s === dados.listas.concluido) return "CONCLUÍDO";
          return valorAtual(p, "prazo") && valorAtual(p, "prazo") < GS.HOJE ? "ATRASADO" : "EM DIA";
        }
        const st = norm(valorAtual(p, "statusRegulacao"));
        if (!st) return "PREENCHER";
        if (st === "Regularizado") return "CONCLUÍDO";
        return "EM DIA";
      }

      function registrar(p, campo, v) {
        const k = kRasc(p.protocoloSiga, campo);
        if (norm(v) === norm(valorBase(p, campo))) delete RASC[k];
        else RASC[k] = { p: p.protocoloSiga, c: campo, v: String(v), a: valorBase(p, campo), em: agora() };
        guardarRasc();
      }
      const agora = () => { const d = new Date(); const z = (n) => String(n).padStart(2, "0"); return `${GS.isoDia(d)}T${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`; };

      /* ----------------------------------------------------------- estrutura */
      const estado = { pessoa: "", situacao: null, pend: "", statusRegulacao: "", busca: "", ordem: "prioridade" };
      mount.replaceChildren();
      mount.append(abertura(cfg, cfg.tituloForm, cfg.ledeForm));
      const fil = H.construirFiltros(cfg, dados, estado, () => { H.lerFiltros(estado, cfg); atualizar(); });
      mount.append(fil);
      const area = el("div", { class: "conteudo-sec" });
      const w = el("div", { class: "largura" });
      area.append(w); mount.append(area);

      // quem está preenchendo + passos
      const quemBarra = el("div", { class: "quem-barra" });
      const campoQuem = el("div", { class: "campo-quem" });
      const quem = el("input", { list: "pessoas-" + chave, autocomplete: "off", placeholder: "Seu nome", maxlength: "80" });
      quem.value = localStorage.getItem(CHAVE_NOME) || "";
      campoQuem.append(el("label", { for: "quem-" + chave }, "Quem está preenchendo"), quem);
      quem.id = "quem-" + chave;
      const dl = el("datalist", { id: "pessoas-" + chave });
      dl.replaceChildren(...(dados.listas[cfg.pessoas] || []).map((n) => el("option", { value: n })));
      campoQuem.append(dl);
      const passos = el("ol", { class: "passos" });
      passos.append(
        liPasso("1", "Escreva seu nome ao lado."),
        liPasso("2", "Preencha os processos. O que mudar fica <strong>não salvo</strong>."),
        liPasso("3", "Clique em <strong>Salvar alterações</strong>."),
      );
      quemBarra.append(campoQuem, passos);
      w.append(quemBarra);
      quem.addEventListener("input", () => { localStorage.setItem(CHAVE_NOME, quem.value.trim()); quem.classList.remove("falta"); });

      // avisos
      const avisos = el("div", { id: "avisos" });
      const aviso = (tipo, icone, cor, texto) => { const a = el("div", { class: "aviso " + tipo, role: "note" }); a.append(svgIcone(ICONES[icone], cor, 18), el("p", null, texto)); return a; };
      avisos.append(aviso("info", "info", "var(--verde-600)", GS.FONTE.live
        ? "Ao salvar, a Data da Vistoria Inicial vai direto para a planilha (aba BASE VISTORIA INICIAL). O integrador leva o valor para a aba VISTORIA INICIAL na próxima atualização."
        : "Visual de demonstração: ao salvar, as alterações ficam guardadas neste navegador e já aparecem nos dashboards. Na conexão com o Sheets, o envio é automático."));
      w.append(avisos);

      // indicadores
      const resumo = el("div", { class: "indicadores" });
      w.append(resumo);

      // lista de cartões
      const listaCard = el("section", { class: "cartao" });
      const cabeca = el("div", { class: "cabeca" });
      const tit = el("div"); tit.append(el("h2", null, "Processos"), el("p", { class: "sub lista-sub" }));
      const acoes = el("div", { class: "acoes-lista" });
      const ordenar = el("select");
      ordenar.replaceChildren(...[["prioridade", "Prioridade"], ["antigos", "Mais antigos"], ["prazo", "Prazo mais próximo"], ["protocolo", "Protocolo"]].map(([v, t]) => el("option", { value: v }, t)));
      ordenar.addEventListener("change", () => { estado.ordem = ordenar.value; atualizar(); });
      const labOrd = el("label", { class: "campo" }, "Ordenar"); labOrd.append(ordenar);
      const exportar = el("button", { class: "botao claro", type: "button" }, "Exportar CSV");
      acoes.append(labOrd, exportar);
      cabeca.append(tit, acoes);
      const corpoLista = el("div");
      const rodape = el("div", { class: "rodape-lista" });
      const info = el("span"); const pag = el("span", { class: "paginas" });
      const ant = el("button", { class: "botao claro", type: "button" }, "Anterior"); const prox = el("button", { class: "botao claro", type: "button" }, "Próxima");
      const numPag = el("span"); pag.append(ant, numPag, prox); rodape.append(info, pag);
      listaCard.append(cabeca, corpoLista, rodape);
      w.append(listaCard);

      // barra de salvar (fixa)
      const barra = el("div", { class: "salvar", hidden: "" });
      const bw = el("div", { class: "largura" });
      const estadoSalvar = el("div", { class: "estado-salvar" });
      const pendentes = el("span", { id: "pendentes" }); const mensagem = el("span", { id: "mensagem", role: "status", "aria-live": "polite" });
      estadoSalvar.append(pendentes, mensagem);
      const acoesSalvar = el("div", { class: "acoes" });
      const btnDescartar = el("button", { class: "botao claro", type: "button" }, "Descartar");
      const btnSalvar = el("button", { class: "botao destaque", type: "button" }, "Salvar alterações");
      const btnOk = el("button", { class: "botao claro", type: "button", hidden: "" }, "OK");
      acoesSalvar.append(btnDescartar, btnSalvar, btnOk);
      bw.append(estadoSalvar, acoesSalvar); barra.append(bw); mount.appendChild(barra);

      /* ----------------------------------------------------------- filtro/ordenação */
      const PRIO = { "ATRASADO": 0, "PREENCHER": 1, "EM DIA": 2, "CONCLUÍDO": 3 };
      function filtrados() {
        let arr = H.aplicarFiltros(PROCS, cfg, dados, estado).filter((p) => {
          if (estado.pend === "acao") return ["ATRASADO", "PREENCHER"].includes(estadoProcesso(p));
          if (estado.pend && estado.pend !== "acao" && cfg.modelo === "pendencia") return estadoProcesso(p) === estado.pend;
          return true;
        });
        const cmp = {
          prioridade: (a, b) => PRIO[estadoProcesso(a)] - PRIO[estadoProcesso(b)] || b.diasAberto - a.diasAberto,
          antigos: (a, b) => b.diasAberto - a.diasAberto,
          prazo: (a, b) => (valorAtual(a, "prazo") || "9999").localeCompare(valorAtual(b, "prazo") || "9999"),
          protocolo: (a, b) => a.protocoloSiga.localeCompare(b.protocoloSiga, "pt-BR", { numeric: true }),
        };
        return arr.sort(cmp[estado.ordem] || cmp.prioridade);
      }

      /* ----------------------------------------------------------- indicadores */
      function desenharIndicadores(linhas) {
        const n = { "PREENCHER": 0, "ATRASADO": 0, "EM DIA": 0, "CONCLUÍDO": 0 };
        for (const p of linhas) n[estadoProcesso(p)]++;
        const total = linhas.length;
        const itens = [indicadorFixo("Processos", nf.format(total), cfg.aba, cfg.icone)];
        const ordem = cfg.modelo === "pendencia" ? ["PREENCHER", "ATRASADO", "EM DIA", "CONCLUÍDO"] : ["PREENCHER", "EM DIA", "CONCLUÍDO"];
        for (const k of ordem) {
          const clicavel = cfg.modelo === "pendencia";
          const ativo = estado.pend === k;
          const b = el(clicavel ? "button" : "div", { type: "button", class: "indicador" + (ativo ? " ativo" : "") });
          const r = el("div", { class: "rotulo" }); r.append(svgIcone(ICONES[PEND[k].icone], PEND[k].cor, 15), el("span", null, PEND[k].plural));
          b.append(r, el("div", { class: "valor" }, nf.format(n[k])), el("div", { class: "nota" }, ativo ? "filtrando · clique para tirar" : pct(n[k], total) + " dos processos"));
          if (clicavel) b.addEventListener("click", () => { estado.pend = ativo ? "" : k; if (estado._selects && estado._selects.pend) estado._selects.pend.value = estado.pend; atualizar(); });
          itens.push(b);
        }
        resumo.replaceChildren(...itens);
      }

      /* ----------------------------------------------------------- cartões */
      const POR_PAGINA = 25;
      let pagina = 0;
      function crescer(t) { t.style.height = "auto"; const h = t.scrollHeight + 2; t.style.height = Math.min(h, 220) + "px"; t.style.overflowY = h > 220 ? "auto" : "hidden"; }
      function controle(p, campo) {
        const id = "c-" + p.protocoloSiga.replace(/[^0-9A-Za-z]/g, "_") + "-" + campo.id;
        const caixa = el("div", { class: "c" + (campo.largo ? " largo" : "") });
        caixa.append(el("label", { for: id }, campo.rot));
        const v = valorAtual(p, campo.id);
        let ctl;
        if (campo.tipo === "select") {
          ctl = el("select", { id, "data-campo": campo.id });
          const nomes = [...(dados.listas[campo.fonte] || [])];
          if (v && !nomes.includes(v)) nomes.unshift(v);
          ctl.append(el("option", { value: "" }, campo.vazio || "—"), ...nomes.map((n) => el("option", { value: n }, n)));
        } else if (campo.tipo === "date") {
          ctl = el("input", { id, "data-campo": campo.id, type: "date", min: "2020-01-01", max: "2099-12-31" });
        } else if (campo.tipo === "numero") {
          ctl = el("input", { id, "data-campo": campo.id, type: "number", min: "0", step: "1", placeholder: "0" });
        } else if (campo.tipo === "textarea") {
          ctl = el("textarea", { id, "data-campo": campo.id, rows: "1", maxlength: "2000", placeholder: campo.ph || "" });
        } else {
          ctl = el("input", { id, "data-campo": campo.id, type: "text", maxlength: "300", placeholder: campo.ph || "" });
        }
        ctl.value = v == null ? "" : v;
        caixa.append(ctl);
        return caixa;
      }
      function pintar(art, p) {
        const est = estadoProcesso(p), editado = temRascunho(p);
        art.className = "processo " + PEND[est].classe + (editado ? " editado" : "");
        art.querySelector(".estado .selo").replaceWith(selo(est));
        const marca = art.querySelector(".marca-salv");
        if (editado) { marca.className = "marca-salv naosalvo"; marca.textContent = "não salvo"; }
        else { marca.className = "marca-salv"; marca.textContent = ""; }
        for (const ctl of art.querySelectorAll("[data-campo]")) ctl.classList.toggle("alterado", kRasc(p.protocoloSiga, ctl.dataset.campo) in RASC);
      }
      function cartaoProcesso(p) {
        const art = el("article", { "data-prot": p.protocoloSiga });
        const info = el("div", { class: "info" });
        const estadoDiv = el("div", { class: "estado" }); estadoDiv.append(el("span", { class: "selo" }), el("span", { class: "marca-salv" }));
        const num = el("div", { class: "num" });
        num.append(el("b", null, p.protocoloSiga), el("span", { class: "sec" }, p.protocoloSga ? "SIGA · SGA " + p.protocoloSga : "SIGA · sem protocolo SGA"));
        if (p.setor === "VIDROS") num.append(el("span", { class: "tag" }, "Vidros"));
        const assoc = el("div", { class: "assoc" });
        assoc.append(el("b", null, p.nome || "(sem nome)"), el("span", { class: "sec" }, [p.placaSiga, p.cobertura].filter(Boolean).join(" · ")));
        const siga = el("div", { class: "siga" });
        siga.append(el("span", null, p.cidade ? p.cidade + "/" + p.uf : "—"), el("span", { class: "sec" }, "Responsável no SIGA: " + (p.responsavel || "—")));
        const dias = el("div", { class: "dias" });
        dias.append(el("b", null, p.diasAberto == null ? "–" : nf.format(p.diasAberto)), el("span", { class: "sec" }, p.diasAberto === 1 ? "dia em aberto" : "dias em aberto"));
        const st = el("div", { class: "st" });
        st.append(el("span", { class: "sec" }, "SIGA: " + (p.statusSiga || "—")), el("span", { class: "sec" }, "SGA: " + (p.statusSga || "—")));
        info.append(estadoDiv, num, assoc, siga, dias, st);
        const campos = el("div", { class: "campos" });
        for (const campo of cfg.campos) campos.append(controle(p, campo));
        art.append(info, campos);
        pintar(art, p);
        return art;
      }

      corpoLista.addEventListener("input", (e) => aoEditar(e, false));
      corpoLista.addEventListener("change", (e) => aoEditar(e, true));
      function aoEditar(e, terminou) {
        const ctl = e.target.closest("[data-campo]"); if (!ctl) return;
        const art = ctl.closest("article"), p = porProt.get(art.dataset.prot); if (!p) return;
        if (ctl.tagName === "TEXTAREA") crescer(ctl);
        registrar(p, ctl.dataset.campo, ctl.value);
        pintar(art, p);
        if (terminou) desenharIndicadores(filtrados());
        atualizarBarra();
      }

      function desenharLista() {
        const itens = filtrados();
        const paginas = Math.max(1, Math.ceil(itens.length / POR_PAGINA));
        pagina = Math.min(pagina, paginas - 1);
        const inicio = pagina * POR_PAGINA, parte = itens.slice(inicio, inicio + POR_PAGINA);
        corpoLista.replaceChildren(...parte.map(cartaoProcesso));
        if (!parte.length) corpoLista.append(el("div", { class: "vazio" }, "Nenhum processo com os filtros atuais."));
        for (const t of corpoLista.querySelectorAll("textarea")) if (t.value) crescer(t);
        info.textContent = itens.length ? `Mostrando ${nf.format(inicio + 1)}–${nf.format(inicio + parte.length)} de ${nf.format(itens.length)}` : "";
        numPag.textContent = ` ${pagina + 1} / ${paginas} `;
        ant.disabled = pagina === 0; prox.disabled = pagina >= paginas - 1;
        for (const s of listaCard.querySelectorAll(".lista-sub")) s.textContent = `${nf.format(itens.length)} de ${nf.format(PROCS.length)} processos, conforme os filtros acima.`;
        estado.ordenadas = itens;
      }
      ant.addEventListener("click", () => { pagina--; desenharLista(); window.scrollTo({ top: listaCard.offsetTop - 70, behavior: "smooth" }); });
      prox.addEventListener("click", () => { pagina++; desenharLista(); window.scrollTo({ top: listaCard.offsetTop - 70, behavior: "smooth" }); });

      function atualizar() { desenharIndicadores(filtrados()); pagina = 0; desenharLista(); atualizarBarra(); }

      /* ----------------------------------------------------------- salvar */
      function atualizarBarra() {
        const rs = Object.values(RASC), n = rs.length, procs = new Set(rs.map((r) => r.p)).size;
        pendentes.textContent = n ? `${plural(n, "alteração", "alterações")} em ${plural(procs, "processo", "processos")} ainda ${n === 1 ? "não salva" : "não salvas"}` : "";
        pendentes.hidden = !n;
        const temMsg = !!mensagem.textContent;
        btnSalvar.hidden = btnDescartar.hidden = !n;
        btnOk.hidden = !temMsg || !!n;
        barra.hidden = !n && !temMsg;
        document.body.classList.toggle("com-barra", !barra.hidden);
      }
      function msg(texto, erro) { mensagem.textContent = texto; mensagem.classList.toggle("erro", !!erro); atualizarBarra(); }
      btnOk.addEventListener("click", () => msg(""));
      btnDescartar.addEventListener("click", () => {
        const n = Object.keys(RASC).length;
        if (!n || !window.confirm(`Descartar ${plural(n, "alteração não salva", "alterações não salvas")}?`)) return;
        RASC = {}; guardarRasc(); msg(""); atualizar();
      });
      btnSalvar.addEventListener("click", async () => {
        const rs = Object.values(RASC); if (!rs.length) return;
        const nome = quem.value.trim();
        if (!nome) { quem.classList.add("falta"); quem.focus(); quem.scrollIntoView({ behavior: "smooth", block: "center" }); msg("Escreva seu nome em “Quem está preenchendo” e clique em Salvar de novo.", true); return; }
        const registros = rs.map((r) => ({ protocolo: r.p, campo: r.c, valor: norm(r.v) }));
        // grava: ao vivo -> Sheets (/api/salvar); demo -> overlay local
        const res = await GS.DB.salvarValores(registros);
        if (res && res.ok === false) {
          msg("Não consegui gravar no Sheets: " + (res.erro || "erro") + ". As alterações ficaram guardadas neste navegador; tente salvar de novo.", true);
          return;
        }
        // aplica no clone local e limpa o rascunho
        for (const r of registros) { const p = porProt.get(r.protocolo); if (p) p[r.campo] = r.valor; }
        RASC = {}; guardarRasc();
        if (GS.FONTE.live) {
          msg(`${plural(registros.length, "data salva", "datas salvas")} na planilha (aba BASE VISTORIA INICIAL). O integrador leva para a aba VISTORIA INICIAL na próxima atualização.`);
        } else {
          const conteudo = { tipo: "preenchimento-" + chave, versao: 1, quem, salvo_em: agora(), pagina_gerada: dados.gerado.iso,
            alteracoes: rs.map((r) => ({ protocolo: r.p, campo: r.c, valor: norm(r.v), anterior: r.a, em: r.em })) };
          conteudo.quem = nome;
          baixarJson(`preenchimento ${cfg.rotulo} - ${nome.replace(/[\\/:*?"<>|]+/g, " ").slice(0, 40).trim()} - ${agora().slice(0, 10)}.json`, conteudo);
          msg(`${plural(registros.length, "alteração salva", "alterações salvas")}. Já aparecem nos dashboards (neste navegador) e um arquivo JSON foi baixado.`);
        }
        atualizar();
      });
      function baixarJson(nome, obj) {
        const a = el("a", { href: URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: "application/json" })), download: nome });
        document.body.append(a); a.click(); a.remove();
      }
      exportar.addEventListener("click", () => {
        const cab = ["Protocolo SIGA", "Protocolo SGA", "Nome", "Placa", "Cidade", "UF", "Responsável SIGA", "Dias", "Status SIGA", "Status SGA", ...cfg.campos.map((c) => c.rot), "Estado"];
        const linhas = (estado.ordenadas || filtrados()).map((p) => [p.protocoloSiga, p.protocoloSga, p.nome, p.placaSiga, p.cidade, p.uf, p.responsavel, p.diasAberto, p.statusSiga, p.statusSga,
          ...cfg.campos.map((c) => { const v = valorAtual(p, c.id); return c.tipo === "date" ? dataBr(v) : v; }), PEND[estadoProcesso(p)].rotulo]);
        GS.exportarCsv(`preenchimento-${chave}.csv`, cab, linhas);
      });
      document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && !barra.hidden) { e.preventDefault(); btnSalvar.click(); } });

      atualizar();
    });

    function liPasso(n, html) { const li = el("li"); li.append(el("b", null, n), el("span", { html })); return li; }
  };
})();
