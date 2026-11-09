# Painel do Sinistro · Grupo Support

Site **novo e independente** que reúne, numa **única página**, os dashboards e o
preenchimento dos três setores do sinistro — **analistas, reguladores e
consultores** — no mesmo padrão visual dos painéis de conferência e
acompanhamento (verde `#a9c927`, Poppins, etiquetas em pílula, gráficos SVG).

```
Início (hero)  ─┐
Dashboards     ─┤ Analistas · Reguladores · Consultores   (indicadores, gráficos, lista)
Preenchimento  ─┘ Analistas · Reguladores · Consultores   (cartões editáveis, salvar)
                 └── menu lateral navega entre tudo, em uma página só
```

> ⚠️ **Uso interno.** As planilhas reais têm nomes e placas de associados. Enquanto
> o site mostra **dados de demonstração** ele pode ser publicado livremente; ao
> ligar nas planilhas reais (etapa 2), ele passa a exigir login e nunca deve ser
> aberto sem senha.

---

## Duas etapas (como combinado)

1. **Visual (agora).** Tudo funciona estático, sem build e sem servidor, com
   **dados de demonstração** que têm as **mesmas colunas das planilhas reais**
   (abas `ANALISTAS`/`VIDROS`, `REGULADORES`, `CONSULTORES TEC.`). É o que o grupo
   support valida. O preenchimento salva no próprio navegador e os dashboards já
   refletem a alteração — demonstrando o ciclo *preenchimento → dados → painel*.
2. **Conexão com o Sheets (após validação).** Troca-se a camada de dados por
   funções serverless que leem/gravam as planilhas do Google com a conta de
   serviço. O resto do site **não muda**. Ver *Próximo passo* abaixo.

---

## Estrutura

```
painel-sinistro/
  index.html              casca: menu lateral, topo, rodapé
  assets/
    estilo.css            design system do Grupo Support + layout (menu, hero)
    base.js               helpers, formatadores, tooltip e gráficos (barras, colunas, matriz)
    dados.js              CAMADA DE DADOS — demo hoje; ponto único de troca para o Sheets
    setores.js            config de cada setor (campos editáveis, colunas da lista)
    app.js                shell + roteador + telas de Início e Dashboards
    formulario.js         telas de Preenchimento (cartões editáveis + salvar)
  vercel.json             cabeçalhos (noindex) — site estático, sem build
  .env.example            variáveis da etapa 2 (conexão com o Sheets)
```

A navegação é por hash (`#/dashboard/analistas`, `#/preenchimento/reguladores`…),
então é uma página só; não há rotas de servidor a configurar.

---

## Ver na sua máquina

Qualquer servidor estático serve. Com o Python que acompanha o Integrador:

```bash
cd painel-sinistro
"../sistema/python/python.exe" -m http.server 8099
```

Abra <http://127.0.0.1:8099>. (Abrir o `index.html` com dois cliques não funciona:
o navegador bloqueia carregar os `assets/*.js` por `file://`.)

---

## Publicar na Vercel

Site **estático, sem build** — *Framework Preset* = **Other**.

**A) Pelo site (sem instalar nada):** suba a pasta `painel-sinistro` para um
repositório no GitHub, em <https://vercel.com/new> clique *Import* e selecione-o.
Em *Root Directory* aponte para `painel-sinistro` se o repositório tiver mais coisa.

**B) Pela linha de comando** (dentro de `painel-sinistro`):

```bash
npm i -g vercel
vercel
```

Na etapa 1 não há variáveis de ambiente a definir. É um projeto Vercel **separado**
do `painel-web` (que publica os painéis gerados pela ferramenta local).

---

## Próximo passo — conectar ao Google Sheets (etapa 2)

Quando o grupo support validar o visual:

1. **Camada de dados.** Em `assets/dados.js`, `GS.DB.carregar(chave)` e
   `GS.DB.salvarValores(...)` são o **único ponto de troca**: passam a ser
   `fetch('/api/dados?setor=…')` e `fetch('/api/salvar', { method:'POST', … })`.
2. **Funções serverless** em `api/` (Node, como no `painel-web`) leem/gravam as
   planilhas **do lado do servidor** com a conta de serviço — a chave nunca vai ao
   navegador. Reaproveitam os IDs das planilhas dos links `GOOGLE_*` de
   `sistema\configuracao.env` e a mesma conta de serviço.
3. **Variáveis** em *Settings → Environment Variables* da Vercel (ver
   `.env.example`): `VIEW_USER`/`VIEW_PASSWORD` (login), `GOOGLE_SERVICE_ACCOUNT_JSON`
   e `SHEET_ANALISTAS` / `SHEET_REGULADORES` / `SHEET_CONSULTORES`.
4. **Login** (HTTP Basic Auth) passa a proteger o site, porque ele exibirá dados
   de associados.

Como as telas só consomem o que a camada de dados devolve, nenhuma tela precisa
ser reescrita nessa troca.
