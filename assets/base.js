/* ------------------------------------------------------------------------- *
 * base.js — fundação compartilhada (namespace global GS)
 * Helpers de DOM, formatadores, ícones, tooltip e gráficos SVG.
 * Mesma linguagem dos painéis do sinistro, reaproveitada em todas as telas.
 * ------------------------------------------------------------------------- */
(function () {
  "use strict";
  const GS = (window.GS = window.GS || {});

  /* ----------------------------------------------------------- DOM */
  function el(tag, atributos, texto) {
    const e = document.createElement(tag);
    for (const k in atributos || {}) {
      if (k === "class") e.className = atributos[k];
      else if (k === "html") e.innerHTML = atributos[k];
      else e.setAttribute(k, atributos[k]);
    }
    // Tudo o que vem de dados entra como texto (nunca HTML): evita injeção.
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  }
  const NS = "http://www.w3.org/2000/svg";
  function svg(tag, atributos, texto) {
    const e = document.createElementNS(NS, tag);
    for (const k in atributos || {}) e.setAttribute(k, atributos[k]);
    if (texto !== undefined) e.textContent = texto;
    return e;
  }
  function svgIcone(d, cor, tamanho) {
    const s = svg("svg", { viewBox: "0 0 24 24", width: tamanho || 15, height: tamanho || 15, "aria-hidden": "true" });
    s.appendChild(svg("path", { d, fill: cor || "currentColor" }));
    return s;
  }
  function aoAtivar(alvo, acao) {
    alvo.addEventListener("click", acao);
    alvo.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); acao(); } });
  }

  /* ----------------------------------------------------------- ícones (traçados 24x24) */
  const ICONES = {
    inicio: "M12 3 2 12h3v8h6v-6h2v6h6v-8h3L12 3Z",
    sinistro: "M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h12v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-8l-2.08-5.99ZM6.5 16a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm11 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3ZM5 11l1.5-4.5h11L19 11H5Z",
    analistas: "M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-8 0a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-2.7 0-8 1.3-8 4v3h9v-3c0-1 .4-1.9 1-2.6A13 13 0 0 0 8 13Zm8 0c-.4 0-.9 0-1.4.1 1.3 1 2.4 2.3 2.4 3.9v3h7v-3c0-2.7-5.3-4-8-4Z",
    reguladores: "M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Zm-1 13-3.5-3.5 1.4-1.4L11 12.2l4.1-4.1 1.4 1.4L11 15Z",
    consultores: "M3 4h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-6l-3 3-3-3H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm3 5v2h12V9H6Zm0 4v2h8v-2H6Z",
    preencher: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm17.71-10.21a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z",
    tabela: "M3 3h18v18H3V3Zm2 2v4h6V5H5Zm8 0v4h6V5h-6Zm-8 6v4h6v-4H5Zm8 0v4h6v-4h-6Zm-8 6v2h6v-2H5Zm8 0v2h6v-2h-6Z",
    relogio: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2.2a7.8 7.8 0 1 1 0 15.6 7.8 7.8 0 0 1 0-15.6ZM11 6.5v6.1l4.6 2.8 1.1-1.8-3.5-2.1V6.5H11Z",
    atraso: "M12 2 1.5 20.5h21L12 2Zm-1.1 6.6h2.2v6h-2.2v-6Zm1.1 7.4a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Z",
    concluido: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.4 14.2-4.2-4.2 1.5-1.5 2.7 2.7 5.9-5.9 1.5 1.5-7.4 7.4Z",
    info: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.1 8.4h2.2v7h-2.2v-7Zm1.1-4.1a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Z",
    seta: "M13.5 5.5 12.1 7l4 4H4v2h12.1l-4 4 1.4 1.5 6.5-6.5-6.5-6.5Z",
    oficina: "M22 9 12 3 2 9v2h2v8h6v-5h4v5h6v-8h2V9Zm-10 1a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z",
    dinheiro: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm.9 15.5v1.3h-1.6v-1.3c-1.6-.2-2.8-1.1-2.9-2.7h1.7c.1.8.7 1.3 1.9 1.3 1.1 0 1.7-.5 1.7-1.2 0-.6-.4-1-1.9-1.4-2-.5-3.1-1.1-3.1-2.7 0-1.4 1.1-2.3 2.6-2.5V6.7h1.6v1.3c1.5.3 2.4 1.2 2.5 2.6h-1.7c-.1-.7-.6-1.2-1.6-1.2-1 0-1.6.5-1.6 1.1 0 .6.5.9 1.9 1.3 2.1.5 3.1 1.2 3.1 2.8 0 1.4-1 2.4-2.6 2.6Z",
    sair: "M16 17v-3H9v-4h7V7l5 5-5 5ZM14 2a2 2 0 0 1 2 2v2h-2V4H5v16h9v-2h2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9Z",
  };
  GS.ICONES = ICONES;

  /* ----------------------------------------------------------- formatadores */
  const nf = new Intl.NumberFormat("pt-BR");
  const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const pct = (a, b) => (b ? Math.round((100 * a) / b) + "%" : "–");
  const pct1 = (a, b) => (b ? (100 * a / b).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%" : "–");
  const pad = (n) => String(n).padStart(2, "0");
  const isoDia = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const HOJE = isoDia(new Date());
  const dataBr = (iso) => (iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "");
  const momentoBr = (iso) => (iso ? dataBr(iso) + (iso.length > 10 ? " " + iso.slice(11, 16) : "") : "");
  const diaUtc = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const diasEntre = (a, b) => Math.round((diaUtc(b) - diaUtc(a)) / 864e5);
  const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  const norm = (s) => String(s ?? "").replace(/\r\n/g, "\n").trim();
  const vazio = (s) => (s === "" || s === null || s === undefined ? "(vazio)" : s);
  const plural = (n, um, varios) => nf.format(n) + " " + (n === 1 ? um : varios);
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const mesRotulo = (ym) => MESES[+ym.slice(5, 7) - 1] + "/" + ym.slice(2, 4);
  Object.assign(GS, { el, svg, svgIcone, aoAtivar, nf, moeda, pct, pct1, isoDia, HOJE, dataBr, momentoBr,
                      diasEntre, semAcento, norm, vazio, plural, MESES, mesRotulo });

  /* ----------------------------------------------------------- tooltip (hover e foco) */
  let dica;
  function garantirDica() {
    if (!dica) dica = document.getElementById("dica") || document.body.appendChild(el("div", { id: "dica", role: "status", "aria-live": "polite" }));
    return dica;
  }
  function mostrarDica(alvo, valor, linhas, evento) {
    const d = garantirDica();
    d.replaceChildren(el("b", null, valor), ...linhas.map((t) => el("span", null, t)));
    const r = alvo.getBoundingClientRect();
    const x = evento && evento.clientX ? evento.clientX : r.left + r.width / 2;
    const y = evento && evento.clientY ? evento.clientY : r.top;
    d.classList.add("visivel");
    const dd = d.getBoundingClientRect();
    d.style.left = Math.max(8, Math.min(window.innerWidth - dd.width - 8, x + 14)) + "px";
    d.style.top = Math.max(8, y - dd.height - 12) + "px";
  }
  const esconderDica = () => dica && dica.classList.remove("visivel");
  function comDica(alvo, conteudo) {
    alvo.addEventListener("pointermove", (e) => { const [v, l] = conteudo(); mostrarDica(alvo, v, l, e); });
    alvo.addEventListener("pointerleave", esconderDica);
    alvo.addEventListener("focus", () => { const [v, l] = conteudo(); mostrarDica(alvo, v, l); });
    alvo.addEventListener("blur", esconderDica);
  }
  Object.assign(GS, { comDica, esconderDica });

  /* ----------------------------------------------------------- gráfico: barras horizontais */
  function barras(caixa, itens, total, aoClicar, longas) {
    if (!itens.length || !itens.some((i) => i.valor > 0)) {
      caixa.replaceChildren(el("div", { class: "vazio" }, "Nada a mostrar com os filtros atuais."));
      return;
    }
    const max = Math.max(...itens.map((i) => i.valor), 1);
    const lista = el("div", { class: longas ? "barras longas" : "barras" });
    for (const item of itens) {
      const linha = el("div", { class: "linha" + (item.ativa ? " ativa" : ""), tabindex: "0" });
      const nome = el("div", { class: "nome", title: item.nome });
      if (item.icone) nome.append(svgIcone(ICONES[item.icone] || item.icone, item.cor || "var(--verde-600)", 14));
      nome.append(el("span", null, item.nome));
      const trilho = el("div", { class: "trilho" });
      const barra = el("div", { class: "barra" });
      barra.style.width = (100 * item.valor / max) + "%";
      if (!item.valor) barra.style.visibility = "hidden";
      trilho.append(barra);
      linha.append(nome, trilho, el("div", { class: "numero" }, nf.format(item.valor)));
      comDica(linha, () => [plural(item.valor, item.unidade || "processo", item.unidadeP || "processos"),
                            [item.nome, pct1(item.valor, total) + " do total filtrado"]]);
      if (aoClicar && item.chave !== undefined) {
        linha.setAttribute("role", "button");
        linha.setAttribute("aria-label", `${item.nome}: ${item.valor}. Filtrar a lista`);
        aoAtivar(linha, () => aoClicar(item.chave));
      }
      lista.append(linha);
    }
    caixa.replaceChildren(lista);
  }

  /* ----------------------------------------------------------- gráfico: colunas por mês */
  function passoLimpo(max, alvo) {
    const bruto = max / alvo, p = Math.pow(10, Math.floor(Math.log10(bruto || 1)));
    return [1, 2, 5, 10].map((k) => k * p).find((s) => s >= bruto) || p;
  }
  function colunasMes(caixa, eixo, conta, rotuloDica) {
    if (!eixo.length) { caixa.replaceChildren(el("div", { class: "vazio" }, "Sem dados para o período.")); return; }
    const W = Math.max(320, caixa.clientWidth || 640), H = 250, m = { t: 18, r: 8, b: 30, l: 44 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const max = Math.max(...eixo.map((k) => conta.get(k) || 0), 1);
    const passo = passoLimpo(max, 4), teto = Math.ceil(max / passo) * passo;
    const y = (v) => m.t + ph - (v / teto) * ph;
    const faixa = pw / eixo.length, larg = Math.max(3, Math.min(24, faixa - 2));
    const g = svg("svg", { class: "grafico", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Eventos por mês" });
    for (let v = 0; v <= teto; v += passo) {
      g.append(svg("line", { class: v ? "grade-y" : "base", x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }));
      g.append(svg("text", { x: m.l - 8, y: y(v) + 4, "text-anchor": "end" }, nf.format(v)));
    }
    const cada = Math.ceil(eixo.length / Math.max(1, Math.floor(pw / 52)));
    const maior = eixo.reduce((a, k) => ((conta.get(k) || 0) > (conta.get(a) || 0) ? k : a), eixo[0]);
    eixo.forEach((k, i) => {
      const v = conta.get(k) || 0, cx = m.l + faixa * i + faixa / 2, topo = y(v), alt = m.t + ph - topo, r = Math.min(4, alt, larg / 2);
      const grupo = svg("g", { class: "mes", tabindex: "0", role: "img", "aria-label": `${mesRotulo(k)}: ${nf.format(v)}` });
      if (v > 0) grupo.append(svg("path", { class: "coluna", d: `M${cx - larg / 2},${m.t + ph} V${topo + r} Q${cx - larg / 2},${topo} ${cx - larg / 2 + r},${topo} H${cx + larg / 2 - r} Q${cx + larg / 2},${topo} ${cx + larg / 2},${topo + r} V${m.t + ph} Z` }));
      grupo.append(svg("rect", { class: "alvo", x: m.l + faixa * i, y: m.t, width: faixa, height: ph }));
      comDica(grupo, () => [nf.format(v) + " eventos", rotuloDica ? rotuloDica(k, v) : [mesRotulo(k)]]);
      g.append(grupo);
      if (i % cada === 0) g.append(svg("text", { x: cx, y: H - 10, "text-anchor": "middle" }, mesRotulo(k)));
      if ((k === maior || i === eixo.length - 1) && v > 0) g.append(svg("text", { class: "valor", x: cx, y: topo - 6, "text-anchor": "middle" }, nf.format(v)));
    });
    caixa.replaceChildren(g);
  }

  /* ----------------------------------------------------------- gráfico: matriz de calor (SIGA x SGA) */
  function matriz(caixa, linhas, getA, getB, aoClicar, rotA, rotB) {
    rotA = rotA || "SIGA"; rotB = rotB || "SGA";
    if (!linhas.length) { caixa.replaceChildren(el("div", { class: "vazio" }, "Nenhum evento com os filtros atuais.")); return; }
    const n = new Map(), porA = new Map(), porB = new Map(), geral = new Map();
    for (const l of linhas) {
      const a = getA(l), b = getB(l);
      n.set(a + "\u0001" + b, (n.get(a + "\u0001" + b) || 0) + 1);
      porA.set(a, (porA.get(a) || 0) + 1); porB.set(b, (porB.get(b) || 0) + 1);
      geral.set(a, (geral.get(a) || 0) + 1); geral.set(b, (geral.get(b) || 0) + 1);
    }
    const ordem = [...geral.entries()].sort((x, y) => (x[0] === "") - (y[0] === "") || y[1] - x[1]).map(([s]) => s);
    const linhasM = ordem.filter((s) => porA.has(s)), colunas = ordem.filter((s) => porB.has(s));
    const max = Math.max(...n.values());
    const nivel = (v) => (v ? Math.max(1, Math.ceil((5 * Math.log(1 + v)) / Math.log(1 + max))) : 0);
    const t = el("table", { class: "matriz" });
    const cab = el("tr"); cab.append(el("th", { class: "canto", scope: "col" }, `${rotA} ↓ / ${rotB} →`));
    for (const c of colunas) cab.append(el("th", { scope: "col" }, vazio(c)));
    cab.append(el("th", { class: "total", scope: "col" }, "Total"));
    t.appendChild(el("thead")).append(cab);
    const corpo = t.appendChild(el("tbody"));
    for (const a of linhasM) {
      const tr = el("tr"); tr.append(el("th", { scope: "row" }, vazio(a)));
      for (const b of colunas) {
        const v = n.get(a + "\u0001" + b) || 0;
        const td = el("td", { class: "n" + nivel(v) + (v ? " celula" : "") + (v && a === b ? " igual" : "") }, v ? nf.format(v) : "·");
        if (v) {
          td.setAttribute("tabindex", "0"); td.setAttribute("role", "button");
          td.setAttribute("aria-label", `${rotA} ${vazio(a)}, ${rotB} ${vazio(b)}: ${v}. Filtrar`);
          comDica(td, () => [nf.format(v) + " processos", [rotA + ": " + vazio(a), rotB + ": " + vazio(b), pct1(v, linhas.length) + " do filtrado"]]);
          if (aoClicar) aoAtivar(td, () => aoClicar(a, b));
        }
        tr.append(td);
      }
      tr.append(el("td", { class: "total" }, nf.format(porA.get(a))));
      corpo.append(tr);
    }
    const pe = el("tr"); pe.append(el("th", { class: "total", scope: "row" }, "Total"));
    for (const b of colunas) pe.append(el("td", { class: "total" }, nf.format(porB.get(b))));
    pe.append(el("td", { class: "total" }, nf.format(linhas.length)));
    corpo.append(pe);
    caixa.replaceChildren(t);
  }

  GS.graficos = { barras, colunasMes, matriz };

  /* ----------------------------------------------------------- exportar CSV */
  GS.exportarCsv = function (nomeArquivo, cabecalho, linhas) {
    const aspas = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const txt = [cabecalho.map(aspas).join(";"), ...linhas.map((l) => l.map(aspas).join(";"))].join("\r\n");
    const a = el("a", { href: URL.createObjectURL(new Blob(["﻿" + txt], { type: "text/csv;charset=utf-8" })), download: nomeArquivo });
    document.body.append(a); a.click(); a.remove();
  };
})();
